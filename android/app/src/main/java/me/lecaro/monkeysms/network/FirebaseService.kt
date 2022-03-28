package me.lecaro.monkeysms.network

import android.content.Intent
import android.os.Build
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class FirebaseService() : FirebaseMessagingService() {
    val TAG = "MyFirebaseMess"
    override fun onNewToken(token: String) {
        super.onNewToken(token)

        val intent = Intent(this, ServerService::class.java)
        intent.putExtra("FCMToken", token)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                startForegroundService(intent)
            } catch (e: Exception) {
                startService(intent)
            }
        } else {
            startService(intent)
        }
    }

    override fun onMessageReceived(p0: RemoteMessage) {

        Log.d(TAG, "onMessageReceived")
        val action = p0.data.get("action") ?: ""
        when (action) {
            "refresh" -> startRefresh()
        }
        Log.d(TAG, "Message notification recieved, ${action}")
    }

    fun startRefresh() {

        Log.d(TAG, "startRefresh starting")
        startServerService(this)
        Log.d(TAG, "startRefresh started")

    }
}