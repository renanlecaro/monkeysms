package me.lecaro.monkeysms.data

import android.content.SharedPreferences
import android.provider.ContactsContract
import android.telephony.PhoneNumberUtils
import android.util.Log
import android.provider.BaseColumns

import android.content.ContentResolver
import android.content.Context
import android.database.Cursor
import android.net.Uri
import androidx.core.database.getLongOrNull
import androidx.core.database.getStringOrNull
import com.google.i18n.phonenumbers.PhoneNumberUtil


val TAG = "pullContacts"
suspend fun pullContacts(pref: SharedPreferences, repo: AppRepository) {
    val lastContactsCheck = pref.getLong("lastContactsCheck", 0)

    Log.d(TAG, "lastContactsCheck : ${lastContactsCheck}")
    val contactsCursor = repo.app.contentResolver?.query(
        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
        arrayOf(
            ContactsContract.Contacts.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        ),
        ContactsContract.Contacts.HAS_PHONE_NUMBER + " > 0 AND " +
                ContactsContract.Contacts.CONTACT_LAST_UPDATED_TIMESTAMP + " > " + lastContactsCheck.toString(),
        null,
        null
    )

    if (contactsCursor != null && contactsCursor.count > 0) {
        val nameIndex = contactsCursor.getColumnIndex(ContactsContract.Data.DISPLAY_NAME)
        val numberIndex =
            contactsCursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
        while (contactsCursor.moveToNext()) {
            val name = contactsCursor.getString(nameIndex)
            val number = contactsCursor.getString(numberIndex)


            registerContactPair(repo, number, name)
        }
        contactsCursor.close()
    }


    val editor = pref.edit()

    editor.putLong("lastContactsCheck", System.currentTimeMillis())
    editor.apply()

}

private suspend fun registerContactPair(repo: AppRepository, number: String, name: String) {
    val TAG = "registerContactPair"
    try {

        if (number == name || number == "" || name == "") return

        val normalized = PhoneNumberUtils.normalizeNumber(number)
        if (normalized == PhoneNumberUtils.normalizeNumber(name)) return
        Log.d(TAG, "Contact updated : ${name} ${number}")
        val parsed = repo.phoneUtil.parse(normalized, repo.defaultCountry)
        if (!repo.phoneUtil.isValidNumber(parsed)) {
            Log.w(TAG, "$name's number is invalid : $number ")
            return
        }
        val formatted = repo.phoneUtil.format(parsed, PhoneNumberUtil.PhoneNumberFormat.E164)

        repo.contactDao.registerPair(formatted, name)
    } catch (e: Exception) {
        Log.e(TAG, "")
    }
}

fun getOneContactByPhoneNumber(ctx: Context, phoneNumber: String): Uri? {
    val TAG = "get1CBPN"

    val uri: Uri =
        Uri.withAppendedPath(
            ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
            Uri.encode(phoneNumber)
        )
    var selectedContactUri: Uri? = null

    val contact: Cursor? = ctx.contentResolver.query(
        uri, arrayOf(
            BaseColumns._ID,
            ContactsContract.Contacts._ID,
            ContactsContract.Contacts.LOOKUP_KEY
        ), null, null, null
    )

    try {
        if (contact != null && contact.getCount() > 0) {

            contact.moveToNext()
            val currentId =
                contact.getLongOrNull(contact.getColumnIndex(ContactsContract.Contacts._ID))
            val mCurrentLookupKey =
                contact.getStringOrNull(contact.getColumnIndex(ContactsContract.Contacts.LOOKUP_KEY))
            Log.d(TAG, "currentId: $currentId")
            Log.d(TAG, "mCurrentLookupKey: $mCurrentLookupKey")
            if (currentId !== null && mCurrentLookupKey !== null) {
                selectedContactUri =
                    ContactsContract.Contacts.getLookupUri(currentId, mCurrentLookupKey)
            }

        }
    } finally {
        if (contact != null) {
            contact.close()
        }
    }

    return selectedContactUri

}