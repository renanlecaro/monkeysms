package me.lecaro.monkeysms.data

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionInfo
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import me.lecaro.monkeysms.R
import com.google.i18n.phonenumbers.PhoneNumberUtil
import android.telephony.TelephonyManager
import android.util.Log
import androidx.annotation.Keep
import androidx.core.app.ActivityCompat
import java.lang.Exception
import java.util.*
import com.google.i18n.phonenumbers.NumberParseException
import android.telephony.SubscriptionManager
import kotlin.collections.HashMap


class AppRepository(val messageDao: MessageDao, val contactDao: ContactDao,
                    val monkeyEventsDao:MonkeyEventsDao,
                    val app: App) {
    val TAG = "AppRepository"


    suspend fun toast( textRessource: Int, vararg formatArgs: String) {
        try {
            val asString = app.getString(textRessource, *formatArgs)
            monkeyEventsDao.insert(MonkeyEvent(asString,"default"))
        } catch (e: Exception) {
            Log.e(TAG, "Toast failed : $e")
        }
    }

    val mGoogleSignInClient: GoogleSignInClient by lazy {

        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestIdToken(app.getString(R.string.default_web_client_id))
            .build()

        GoogleSignIn.getClient(app, gso)
    }
    val phoneUtil by lazy {
        PhoneNumberUtil.getInstance(app)
    }
    val defaultCountry by lazy {
        getUserCountry(app)
    }

    val userNumberCountryCodes: List<Int> by lazy {
        loadUserNumberCountryCodes()
    }

    fun loadUserNumberCountryCodes(): List<Int> {
        return loadUserNumbers().map {
            phoneUtil.parse(it, defaultCountry).countryCode
        }
    }

    fun checkNumber(input: String): NumberCheck {
        try {
            val parsed = phoneUtil.parse(input, defaultCountry)
            val formatted = phoneUtil.format(parsed, PhoneNumberUtil.PhoneNumberFormat.E164)
            val type = phoneUtil.getNumberType(parsed)

            val problemWithType = when (type) {
                PhoneNumberUtil.PhoneNumberType.FIXED_LINE -> "Landline number"
                PhoneNumberUtil.PhoneNumberType.UNKNOWN -> "Unknown type"
                PhoneNumberUtil.PhoneNumberType.SHARED_COST -> "Shared cost number"
                PhoneNumberUtil.PhoneNumberType.PREMIUM_RATE -> "Premium rate number"
                else -> null
            }

            if (problemWithType !== null) {
                return NumberCheck(input, formatted, "Number refused : ${problemWithType}")
            }

            if (!phoneUtil.isValidNumber(parsed)) {
                return NumberCheck(input, formatted, "Number is invalid ")
            }
            if (!userNumberCountryCodes.contains(parsed.countryCode)) {
                return NumberCheck(
                    input,
                    formatted,
                    "Sending a message to ${parsed.toString()} (country ${parsed.countryCode}) could be expensive (${userNumberCountryCodes} supported)"
                )
            }


            return NumberCheck(input, formatted, null)
        } catch (e: NumberParseException) {
            Log.e(TAG, "NumberParseException was thrown: $e")
            return NumberCheck(input, "", "Could not parsed : ${e}")
        }
    }


    fun getUserCountry(context: Context): String {
        try {
            val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

            val simCountry = tm.simCountryIso
            if (simCountry != null && simCountry.length == 2) { // SIM country code is available
                return simCountry.uppercase(Locale.US)
            } else if (tm.phoneType != TelephonyManager.PHONE_TYPE_CDMA) { // device is not 3G (would be unreliable)
                val networkCountry = tm.networkCountryIso
                if (networkCountry != null && networkCountry.length == 2) { // network country code is available
                    return networkCountry.uppercase(Locale.US)
                }
            }
        } catch (e: Exception) {
        }
        return "US"
    }

    fun simIdHash():HashMap<Int, String>{
        val result=HashMap<Int, String>()
        getSimNumbersList(app).forEach{
            val userNumber=phoneUtil.parse(it.number, "")
            if(phoneUtil.isValidNumber(userNumber)){
                result[it.simSlotIndex]=phoneUtil.format(userNumber, PhoneNumberUtil.PhoneNumberFormat.E164)
            }else{
                Log.w(TAG, "Invalid sim number "+it.number)
            }
        }
        return result
    }

    fun loadUserNumbers(): List<String> {
        try {
            return getSimNumbersList(app).map { it.number }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load number $e")
            return listOf()
        }
    }

    private fun prefs(): SharedPreferences {
        Log.d(TAG, "getting preference object ")
        return app.getSharedPreferences("me.lecaro.monkeysms", Context.MODE_PRIVATE)
    }

    fun getKey(key: String): String? {
        return prefs().getString(key, null)
    }

    fun getDeviceId(): String? {
        return getKey("deviceId")
    }

    fun getDeviceIdOrUnknown(): String {
        return getDeviceId() ?: "Unknown device"
    }

    fun setKey(key: String, value: String?) {
        Log.d(TAG, "Setting key $key to $value ")
        with(prefs().edit()) {
            if (value === null) {
                remove(key)
            } else {
                putString(key, value)
            }
            apply()
        }
    }

    suspend fun numberThatCanSendTo(to:String):SenderInfo{
        val tbd=SenderInfo("tbd","tbd")
        val deviceId=getDeviceId()
        if(deviceId==null) {
            Log.d(TAG, "numberThatCanSendTo(${to}) : no deviceid, using tbd")
            return tbd
        }
        val localNumbers=loadUserNumbers()
        // check past messages
        val lastMsg=messageDao.lastMessageForContact(to).firstOrNull()
        if(lastMsg !== null){
            val simNumber=if (lastMsg.outbound ) lastMsg.from else lastMsg.to
            val simCardIsHere =localNumbers.find {
                it==simNumber
            } != null
            
            if(sameCountry(to, simNumber) && lastMsg.deviceId==deviceId && simCardIsHere){
                Log.d(TAG, "numberThatCanSendTo(${to}) : the last message was sent from this phone, using same sim and ")
                // send from same number, locally
                return SenderInfo(simNumber, lastMsg.deviceId)
            }
            else
                // let server check if other device online & all
                return tbd
        }

        // look for a local number that could do the sending, without involving the server
        val localNumber=localNumbers.find{
            sameCountry(to, it)
        }

        if(localNumber!=null && deviceId!= null){
            return SenderInfo(localNumber, deviceId)
        }

        //  let the server figure it out
        return tbd
    }

    fun sameCountry(number1:String, number2: String):Boolean{
        val parsed1=phoneUtil.parse(number1, defaultCountry)
        val parsed2=phoneUtil.parse(number2, defaultCountry)
        if(!phoneUtil.isValidNumber(parsed1)) return false
        if(!phoneUtil.isValidNumber(parsed2)) return false
        return parsed1.countryCode ==  parsed2.countryCode
    }
}


data class SenderInfo(val from:String, val deviceId:String)



fun getSimNumbersList(ctx: Context): List<SubscriptionInfo> {

    val TAG = "getSimNumbersList"
    if (ActivityCompat.checkSelfPermission(
            ctx,
            Manifest.permission.READ_PHONE_STATE
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        Log.e(TAG, "READ_PHONE_STATE missing")
        return listOf()
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return listOf()


    val subManager =
        ctx.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
    val subscriptionList = subManager.activeSubscriptionInfoList.toList()
    if (subscriptionList.isNotEmpty())
        return subscriptionList

//
//    val tm = ctx.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
//    if (tm.line1Number !== null) return listOf(tm.line1Number)

    return listOf()
}

@Keep
data class NumberCheck(val original: String, val formatted: String, val problem: String?)