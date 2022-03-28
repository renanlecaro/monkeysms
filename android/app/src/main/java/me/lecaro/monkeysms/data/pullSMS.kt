package me.lecaro.monkeysms.data

import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import android.util.Log
import com.google.i18n.phonenumbers.PhoneNumberUtil

suspend fun pullSMS(repo: AppRepository) {

     val phoneUtil=   PhoneNumberUtil.getInstance(repo.app)
    val TAG = "pullSMS"
    val deviceId=repo.getDeviceId()
    if(deviceId==null) {
        Log.w(TAG, "No device id")
        return
    }
    var messagesCursor: Cursor? = repo.app.getContentResolver().query(
        Uri.parse("content://sms/"),
        null, null, null, null
    )

    val simNumbers=repo.simIdHash()
    Log.d(TAG, "simNumbers : $simNumbers")

    if (messagesCursor != null && messagesCursor.count > 0) {
        while (messagesCursor.moveToNext()) {
            try{

            var summary = ""
            messagesCursor.columnNames.forEach {columnsName->
                summary+= columnsName+" : "+messagesCursor.getString(messagesCursor.getColumnIndexOrThrow(columnsName))+"\n"
            }


            val text = messagesCursor.getString(messagesCursor.getColumnIndexOrThrow("body"))
            val type=messagesCursor.getInt(messagesCursor.getColumnIndexOrThrow("type"))
            val address = messagesCursor.getString(messagesCursor.getColumnIndexOrThrow("address"))
            val date = messagesCursor.getLong(messagesCursor.getColumnIndexOrThrow("date"))
            val error_code = messagesCursor.getLong(messagesCursor.getColumnIndexOrThrow("error_code"))
            val seen = messagesCursor.getInt(messagesCursor.getColumnIndexOrThrow("seen"))
            val sim_id = messagesCursor.getInt(messagesCursor.getColumnIndexOrThrow("sim_id"))
            val userNumber=simNumbers[sim_id]
            if(userNumber==null) {
                Log.w(TAG, "Could not parse sim number : $summary")
                continue
            }

            val addressParsed=phoneUtil.parse(address, repo.defaultCountry)
            if(!phoneUtil.isValidNumber(addressParsed)){
                Log.w(TAG, "Number is invalid : $summary")
            }
            val addressFormatted=phoneUtil.format(addressParsed, PhoneNumberUtil.PhoneNumberFormat.E164)

            val message= when(type){
                Telephony.TextBasedSmsColumns.MESSAGE_TYPE_INBOX->
                    createMessage(
                        from = addressFormatted,
                        to =  userNumber,
                        synced = false,
                        status =   "RECEIVED",
                        outbound = false,
                        text = text,
                        deviceId=deviceId,
                        createdAt = date,
                        seen =  seen >0
                    )
                Telephony.TextBasedSmsColumns.MESSAGE_TYPE_SENT->
                    createMessage(
                        from = userNumber,
                        to = addressFormatted,
                        synced = false,
                        status = if(error_code>0)  "ERROR" else  "SENT",
                        outbound = true,
                        text = text,
                        deviceId=deviceId,
                        createdAt = date,
                        seen=true // user should not be notified of having sent the message
                    )
                Telephony.TextBasedSmsColumns.MESSAGE_TYPE_DRAFT,
                Telephony.TextBasedSmsColumns.MESSAGE_TYPE_OUTBOX,
                Telephony.TextBasedSmsColumns.MESSAGE_TYPE_QUEUED,
                Telephony.TextBasedSmsColumns.MESSAGE_TYPE_FAILED->null
                else -> null
            }
            if(message!==null) {
                Log.d(TAG, "SMS imported : $summary $message")
                repo.messageDao.insert(message)
            }else{
                Log.d(TAG, "SMS ignored because of type : $summary")
            }
            }catch (e:Exception){
                Log.e(TAG, "Error while importing SMS : $e")
            }


        }
        messagesCursor.close()
    }

//    }


}
