package me.lecaro.monkeysms.network

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import me.lecaro.monkeysms.R
import me.lecaro.monkeysms.config
import me.lecaro.monkeysms.data.*
import me.lecaro.monkeysms.sms.ReceiptsReceiver
import me.lecaro.monkeysms.ui.HomeActivity
import retrofit2.HttpException
import java.time.LocalDateTime
import java.util.*
import kotlin.collections.ArrayList

class ServerService() : Service() {
    val TAG = "ServerService"
    val job = SupervisorJob()

    override fun onDestroy() {
        Log.d(TAG, "onDestroy")
        job.cancel()
        NotificationManagerCompat.from(applicationContext)
            .cancel(config.FORGROUND_SERVICE_NOTIFICATION_ID)
        super.onDestroy()
    }

    override fun onBind(p0: Intent?): IBinder? {
        Log.d(TAG, "onBind ")
        return null
    }

    private fun prefs(): SharedPreferences {
        Log.d(TAG, "getting preference object ")
        return applicationContext.getSharedPreferences("me.lecaro.monkeysms", Context.MODE_PRIVATE)
    }

    fun setKey(key: String, value: String?) {
        repo.setKey(key, value)
    }


    val repo: AppRepository by lazy {
        (applicationContext as App).repository
    }

    var running=0
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {

        running++
        Log.d(TAG, "onStartCommand ")
        CoroutineScope(job).launch {
            try {
                val deviceId = repo.getDeviceId()
                val FCMToken = intent?.getStringExtra("FCMToken")
                val googleLoginToken = intent?.getStringExtra("googleLoginToken")
                val wipeRequest = intent?.getBooleanExtra("wipe",false)
                if(wipeRequest==true){

                    Log.d(TAG, "onStartCommand was a wipeRequest, wiping and stoping")
                    wipe()
                    stopSelf()
                    return@launch
                }
                Log.d(TAG, "onStartCommand/deviceId :${deviceId}")
                Log.d(TAG, "onStartCommand/FCMToken :${FCMToken}")
                Log.d(TAG, "onStartCommand/googleLoginToken :${googleLoginToken}")


                FCMToken?.let {
                    setKey("FCMToken", it)
                }
                googleLoginToken?.let {
                    setKey("googleLoginToken", it)
                }

                if (googleLoginToken !== null && FCMToken !== null && deviceId == null) {
                    Log.d(TAG, "onStartCommand/connectToServer")

                    connectToServer(googleLoginToken, FCMToken)
                } else if (FCMToken !== null && deviceId !== null) {
                    Log.d(TAG, "onStartCommand/updateFCMToken")

                    MonkeyApi.retrofitService.updateFCMToken(
                        UpdateFCMTokenRequest(
                            FCMToken = FCMToken,
                            deviceId = deviceId
                        )
                    )
                } else {
                    syncMessages()
                }
                sendPendingSMS()

            } catch (e: Exception) {
                repo.toast(R.string.server_connection_failed, e.toString())
                Log.e(TAG, "Service crashed : ${e}")
            }
            running--
            if(running<=0){
                stopSelf()
            }
        }

        return START_STICKY

    }

    @SuppressLint("HardwareIds")
    suspend fun connectToServer(googleLoginToken: String, FCMToken: String) {

        try {
            Log.d(TAG, "connecting to server, but first wiping")
            wipe()
            Log.d(TAG, "done wiping, now we can login")
            val deviceName = Settings.Secure.getString(contentResolver, "bluetooth_name")
            val androidId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID);


            Log.d(TAG, "Registering .. ")
            val request=RegisterAppRequest(
                    FCMToken = FCMToken,
                    googleLoginToken = googleLoginToken,
                    deviceName = deviceName,
                    androidId = androidId,
                    userNumbers = repo.loadUserNumbers()
                )
            Log.d(TAG, request.toString())

            val result: RegistrationResult = MonkeyApi.retrofitService.registerApp(
                request
            )

            Log.d(TAG, "Registered ! $result ")
            setKey("deviceId", result.deviceId)
            pullSMS(repo)
            syncMessages()

        } catch (e: Exception) {
            Log.e(TAG, "connectToServer crashed : ${e}")
            repo.toast(R.string.server_connection_failed, e.toString())
        }
    }

    suspend fun syncMessages() {
 
        val deviceId = repo.getDeviceId()
        if (deviceId === null) return

        setKey("last-sync", "Syncing...")
        Log.d(TAG, "syncMessages starts")
        try {
            pullContacts(prefs(),repo)
            do {


                val messagesToSync = repo.messageDao.needSync()
                val contactsToSync = repo.contactDao.needSync()

                val result = MonkeyApi.retrofitService.synchronize(
                    SynchronisationParams(
                        deviceId = deviceId,
                        messages = messagesToSync,
                        contacts = contactsToSync,
                        userNumbers=repo.loadUserNumbers()
                    )
                )

                result.changed?.forEach {
                    repo.messageDao.upsert(
                        createMessage(
                            it._id,
                            it.from,
                            it.to,
                            it.outbound,
                            it.text,
                            it.status,
                            true,
                            it.deviceId,
                            it.createdAt
                        )
                    )
                }

                repo.contactDao.markAllSynced(contactsToSync)
                messagesToSync.forEach { repo.messageDao.markSynced(it._id, it.status) }

                // the list was probably cropped, run that thing again
            } while (contactsToSync.size == 100 || messagesToSync.size == 100)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                setKey("last-sync","Last successful sync : "+LocalDateTime.now().toString())
            }else{
                setKey("last-sync", "Synced")
            }


        } catch (e: HttpException) {
            if (e.code() == 401) {
                // Device has been deleted
                wipe()
            }else{
                setKey("last-sync", "Last sync failed : ${e.message()}")
            }
            Log.e(TAG, "syncMessages crashed : ${e}")

            repo.toast(R.string.error_with, "Sync", e.toString())
        } catch (e: Exception) {
            Log.e(TAG, "syncMessages crashed : ${e}")
            setKey("last-sync", "Last sync failed : ${e.toString()}")
        }

    }


    suspend fun wipe() {
        Log.d(TAG, "wiping")
        repo.mGoogleSignInClient.signOut()
        repo.contactDao.wipe()
        repo.messageDao.wipe()
        setKey("deviceId", null)
        setKey("lastContactsCheck", null)
        Log.d(TAG, "wiped")
    }

    suspend fun sendPendingSMS() {

        setKey("isSendingSMS", "yes")
        Log.d(TAG, "sendPendingSMS")

        var tryNext: Boolean

        do {
            tryNext = false
            val result = repo.messageDao.nextMessageToSend(repo.getDeviceId()?:"")

            Log.d(TAG, "result.status : ${result.status}")
            Log.d(TAG, "result.message : ${result.message}")
            if (result.status == "BUSY") {
                return
            }
            if (result.status === "DONE") {
                return
            }
            if (result.status === "READY" && result.message !== null) {
                try {
                    val parsingResult=repo.checkNumber(result.message.to)
                    if(parsingResult.problem!=null){
                        throw Exception("Refused to send SMS : ${parsingResult.problem}")
                    }
                    sendMessage(applicationContext, parsingResult.formatted, result.message)
                    // we'll try to send the next one after the send result
                } catch (e: Exception) {
                    repo.messageDao.updateStatus(result.message._id, "ERROR")
                    repo.toast(R.string.send_message_failed, e.toString())
                    Log.e(TAG, "Failed to send : ${e}")
                    tryNext = true
                }
            }
        } while (tryNext)
        setKey("isSendingSMS", "no")

    }

    override fun onCreate() {
        super.onCreate()
        putToForeground()
    }

    fun putToForeground() {
        Log.i(TAG, "putToForeground started ..")
        CoroutineScope(job).launch {
            try{
                val intent = Intent(applicationContext, HomeActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }

                val pendingIntent: PendingIntent = PendingIntent.getActivity(
                    applicationContext,
                    0,
                    intent,
                    PendingIntent.FLAG_IMMUTABLE
                )

                val builder = NotificationCompat
                    .Builder(applicationContext, config.SERVICE_NOTIFICATION_CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_baseline_sms_24)
                    .setContentTitle("Monkey SMS")
                    .setContentText("Synchronizing")
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)

                startForeground(config.FORGROUND_SERVICE_NOTIFICATION_ID, builder.build())
                Log.i(TAG, "putToForeground_worked")
            }catch (e:Exception){
                Log.e(TAG, "putToForeground failed ${e}")
                repo.toast(R.string.putToForeground_failed, e.toString())
            }

        }
    }

}

fun startServerService(
    context: Context,
    FCMToken: String? = null,
    googleLoginToken: String? = null,
    wipe:Boolean=false
) {
    val TAG = "startServerServ"
    val intent = Intent(context, ServerService::class.java)
    FCMToken?.let { intent.putExtra("FCMToken", it) }
    googleLoginToken?.let { intent.putExtra("googleLoginToken", it) }
    if(wipe)  intent.putExtra("wipe", true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        try {
            context.applicationContext.startForegroundService(intent)
        } catch (e: Exception) {
            Log.e(TAG, "applicationContext.startForegroundService failed, ${e}")
            context.startService(intent)
        }
    } else {
        context.startService(intent)
    }
}



fun sendMessage(context: Context,formatted:String,  message: Message) {

    if (ActivityCompat.checkSelfPermission(
        context,
        Manifest.permission.READ_PHONE_STATE
    ) != PackageManager.PERMISSION_GRANTED
    ) {
        throw java.lang.Exception("Can't check if there's a SIM with this from number, missing permission : Manifest.permission.READ_PHONE_STATE")
    }

    val subManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
    val  subId= subManager.activeSubscriptionInfoList.toList().find { it.number == message.from }?.getSubscriptionId()
    if(subId==null){
          throw java.lang.Exception("No sim matching from number : ${message.from}")
    }

   val manager =   SmsManager.getSmsManagerForSubscriptionId(subId)

    val local_msg_uri= saveSendingMessage(context,message )

    val split = manager.divideMessage(message.text)
    manager.sendMultipartTextMessage(
        formatted, null, split,
        listOfIntents(context, split.size, message._id, "sent",local_msg_uri),
        listOfIntents(context, split.size, message._id, "delivered",local_msg_uri),
    )
}


fun saveSendingMessage(context: Context,  message: Message):Uri?{

    val values  =  ContentValues();
    values.put("address", message.to);
    values.put("body", message.text);
    values.put("date", Calendar.getInstance().getTimeInMillis());
    values.put("read", 1);
    values.put("type", 4);
    return context.getContentResolver().insert(Uri.parse("content://sms/"), values)
}

fun listOfIntents(
    context: Context,
    size: Int,
    _id: String,
    event: String,
    local_msg_uri:Uri?
): ArrayList<PendingIntent> {
    val intents = mutableListOf<PendingIntent>()
    repeat(size) {
        val intent = Intent(
            context,
            ReceiptsReceiver::class.java
        )
        intent.action = event + _id
        intent.putExtra("message_id", _id)
        intent.putExtra("event", event)
        if(local_msg_uri!=null)
         intent.putExtra("local_msg_uri", local_msg_uri.toString())
        intents.add(
            PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE
            )
        )
    }
    return intents as ArrayList<PendingIntent>
}

