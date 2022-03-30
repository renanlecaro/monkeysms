package me.lecaro.monkeysms.sms

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.CompletableJob
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import me.lecaro.monkeysms.data.App
import me.lecaro.monkeysms.data.AppRepository
import me.lecaro.monkeysms.network.startServerService
import java.util.*
import me.lecaro.monkeysms.R

class SendingFailedReceiver : BroadcastReceiver() {
    val TAG = "FailEvt"
    val job = SupervisorJob()
    override fun onReceive(context: Context, intent: Intent) {
        CoroutineScope(job).launch {
            if (context !== null) {
                val repo: AppRepository = (context.applicationContext as App).repository
                repo.messageDao.updateAllInStatus("SENDING", "ERROR")
                startServerService(context)
            }
            job.cancel()
        }

    }

}


class ReceiptsReceiver : BroadcastReceiver() {

    val job = SupervisorJob()
    val TAG: String = "ReceiptsReceiver"


    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "onReceive intent action : ${intent.action}")

        val _id = intent.getStringExtra("message_id")
        val event = intent.getStringExtra("event")
        val uri = Uri.parse(intent.getStringExtra("local_msg_uri"))


        if (_id !== null) {
            CoroutineScope(job).launch {

                Log.d(TAG, " id : ${_id}")
                Log.d(TAG, " event : ${event}")
                val repo: AppRepository = (context.applicationContext as App).repository
                val message = repo.messageDao.get(_id)

                if (event == "sent" && message !== null) {
                    if (resultCode == Activity.RESULT_OK) {
                        repo.messageDao.updateStatus(_id, "SENT")
                        try {
                            val values = ContentValues();
                            values.put("type", 2);
                            values.put("read", 1);
                            context.getContentResolver().update(uri, values, null, null);

//                            repo.toast( R.string.sending_worked)
                        } catch (e: Exception) {
                            repo.toast(R.string.error_with, "Write send success", e.toString())

                            Log.e(TAG, e.toString())
                        }

                    } else {
                        try {
                            val values = ContentValues();
                            values.put("type", 5);
                            values.put("read", true);
                            values.put("error_code", resultCode);
                            context.getContentResolver().update(uri, values, null, null);

                            repo.toast(R.string.sending_failed)
                        } catch (e: Exception) {
                            Log.e(TAG, e.toString())
                            repo.toast(R.string.error_with, "Write send failure", e.toString())
                        }

                        notify(
                            context,
                            message.from,
                            "Could not send message " + errorName(resultCode),
                            repo
                        )
                        repo.messageDao.updateStatus(_id, "ERROR")

                    }

                }
                if (event == "delivered") {
                    repo.messageDao.updateStatus(_id, "RECEIVED")
                    try {
                        val values = ContentValues();
                        values.put("status", "0");
                        values.put("date_sent", Calendar.getInstance().getTimeInMillis());
                        values.put("read", true);
                        context.getContentResolver().update(uri, values, null, null);
//                            repo.toast( R.string.message_delived)
                    } catch (e: Exception) {
                        repo.toast(R.string.error_with, "Write delivery status", e.toString())
                        Log.e(TAG, e.toString())
                    }

                }

                Log.d(TAG, "startServerService")
                startServerService(context)
                Log.d(TAG, "startServerService done")

                job.cancel()
            }
        }

    }
}