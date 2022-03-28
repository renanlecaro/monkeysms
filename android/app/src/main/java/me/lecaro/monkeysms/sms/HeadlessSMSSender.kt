package me.lecaro.monkeysms.sms

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import me.lecaro.monkeysms.data.App
import me.lecaro.monkeysms.data.AppRepository
import me.lecaro.monkeysms.data.createMessage
import me.lecaro.monkeysms.network.startServerService

class HeadlessSMSSender : Service() {
    private val TAG = "HeadlessSMSSender"
    val job = SupervisorJob()

    override fun onDestroy() {
        Log.d(TAG, "onDestroy")
        job.cancel()
        super.onDestroy()
    }

    override fun onBind(p0: Intent?): IBinder? {
        Log.d(TAG, "onBind ")
        return null
    }

    val repo: AppRepository by lazy {
        (applicationContext as App).repository
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {


        CoroutineScope(job).launch {

                intent?.data?.let {
                    val base = it.schemeSpecificPart
                    val position = base.indexOf('?')
                    val to = if (position == -1) base else base.substring(0, position)
                    val text = intent.getStringExtra(Intent.EXTRA_TEXT);
                    if (to !== "" && text !== "" && text !== null) {

                        val sender=repo.numberThatCanSendTo(to)
                        val msg = createMessage(
                            from = sender.from,
                            to = to,
                            outbound = true,
                            text = text,
                            status = "SENDING",
                            synced = false,
                            deviceId = sender.deviceId
                        )
                        repo.messageDao.upsert(msg)

                        startServerService(applicationContext)

                    }
                }
                stopSelf(startId)
            }
        return START_STICKY
    }
}