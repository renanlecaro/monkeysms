package me.lecaro.monkeysms

object config {
    val SERVICE_NOTIFICATION_CHANNEL_ID = "notifs"
    val SMS_NOTIFICATION_CHANNEL_ID = "smss"
    val FORGROUND_SERVICE_NOTIFICATION_ID = 65945

    val SMS_PERMISSION_REQUEST_CODE = 5

    val SERVER_URL=if(BuildConfig.DEBUG) devURL else "https://monkeysms.com"

}