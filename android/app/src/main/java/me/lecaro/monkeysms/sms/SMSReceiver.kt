package me.lecaro.monkeysms.sms

import android.Manifest
import android.annotation.TargetApi
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsMessage
import android.telephony.SubscriptionManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import me.lecaro.monkeysms.ui.ConversationActivity
import me.lecaro.monkeysms.R
import me.lecaro.monkeysms.config
import me.lecaro.monkeysms.data.App
import me.lecaro.monkeysms.data.AppRepository
import me.lecaro.monkeysms.data.Message
import me.lecaro.monkeysms.data.createMessage
import me.lecaro.monkeysms.network.startServerService
import java.util.*


class MMSReceiver : BroadcastReceiver() {
    val job = SupervisorJob()
    val TAG: String = MMSReceiver::class.java.getSimpleName()
    override fun onReceive(context: Context, intent: Intent) {

        CoroutineScope(job).launch {
            try {

                val text = "<" + context.getString(R.string.mms_not_supported) + ">"
                val to= interSubscriptionNumber(context, intent)
                val from= intent.getStringExtra("address")
                if(from==null)
                    throw java.lang.Exception("MMS intent missing address")
                messageReceived(context, from,to, text)

            } catch (e: java.lang.Exception) {
                Log.e(TAG, "newParse $e")
            }
            job.cancel()
        }
    }
}

fun interSubscriptionNumber(context: Context, intent: Intent):String{
      val subId = intent.getIntExtra("subscription", -1)
    if (subId == -1) throw java.lang.Exception("No subscription for incoming  MMS")
    if (ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_PHONE_STATE
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        throw java.lang.Exception("READ_PHONE_STATE missing to check the phone number of received MMS")
    }
    val subManager =
        context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
    return subManager.getActiveSubscriptionInfo(subId).number

}

class SMSReceiver : BroadcastReceiver() {
    val job = SupervisorJob()
    val TAG: String = SMSReceiver::class.java.getSimpleName()

    @TargetApi(Build.VERSION_CODES.M)
    override fun onReceive(context: Context, intent: Intent) {

        CoroutineScope(job).launch {
            try {
                val messageParts: Array<SmsMessage> =
                    Telephony.Sms.Intents.getMessagesFromIntent(intent)
                val from = messageParts[0].originatingAddress
                val text = messageParts.joinToString(separator = "") { it.messageBody }
                val to= interSubscriptionNumber(context, intent)

                if (from !== null && text !== "") {
                    messageReceived(context, from, to, text)
                    val values = ContentValues();
                    values.put("address", from);
                    values.put("body", text);
                    values.put("date", Calendar.getInstance().getTimeInMillis());
                    values.put("read", 1);
                    values.put("type", 1);

                    context.getContentResolver().insert(Uri.parse("content://sms/"), values)
                }


            } catch (e: java.lang.Exception) {
                Log.e(TAG, "newParse $e")
            }
            job.cancel()
        }
    }
}


suspend fun messageReceived(context: Context, from: String, to: String, text: String) {
    val repo: AppRepository = (context.applicationContext as App).repository

    val msg = createMessage(
        from = from,
        to = to,
        outbound = false,
        text = text,
        status = "RECEIVED",
        synced = false,
        deviceId = repo.getDeviceIdOrUnknown()
    )
    repo.messageDao.insert(msg)
    notify(context, msg.from, msg.text, repo)
    startServerService(context)

}

suspend fun notify(context: Context, from: String, text: String, repo: AppRepository) {
    val TAG = "notify"
    try {
        var contact = repo.contactDao.byNumber(from)
        val intent = Intent(context, ConversationActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        intent.data = Uri.parse("sms:" + from)

        val pendingIntent: PendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat
            .Builder(context, config.SMS_NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_baseline_sms_24)
            .setContentTitle(contact?.name ?: from)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        NotificationManagerCompat.from(context).notify(contact?.id ?: 42, builder.build())


    } catch (e: Exception) {
        Log.e(TAG, e.toString())
    }
}