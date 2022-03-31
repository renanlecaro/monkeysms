package me.lecaro.monkeysms.ui

import android.app.NotificationManager
import android.content.Context
import android.util.Log
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import me.lecaro.monkeysms.data.AppRepository
import me.lecaro.monkeysms.data.SharedPreferenceStringLiveData
import me.lecaro.monkeysms.data.createMessage
import me.lecaro.monkeysms.network.startServerService

class ConversationViewModel(val repo: AppRepository) : ViewModel() {
    val TAG="ConversationVM"
    val lastSync: LiveData<String> by lazy {
        val sharedPrefs =
            repo.app.getSharedPreferences("me.lecaro.monkeysms", Context.MODE_PRIVATE)
        SharedPreferenceStringLiveData(sharedPrefs, "last-sync", "")
    }
    val messages by lazy {
        repo.messageDao.messagesWithContact(contact)
    }

    var contact:String="";
    var contactName = MutableLiveData<String>("");
    fun setNumber(contactNumber:String){
        contact=contactNumber
        viewModelScope.launch {
            var contact=repo.contactDao.byNumber(contactNumber)
            contactName.value=contact?.name ?: contactNumber
        }
    }


    fun clearNotification(){
     viewModelScope.launch {
        repo.contactDao.byNumber(contact)?.let{
                val manager=repo.app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.cancel(it.id)
            }
        }
    }


    fun send(text:String){
        if(text=="") return
        viewModelScope.launch {
            try{

                Log.d(TAG,"send ${text} to ${contact}")
                val sender=repo.numberThatCanSendTo(contact)
                Log.d(TAG,"will send from :  ${sender}")
                repo.messageDao.upsert(
                    createMessage(
                        from= sender.from  ,
                        to=contact,
                        outbound=true,
                        text=text,
                        status="ON_DEVICE",
                        synced=false,
                        deviceId = sender.deviceId
                    )
                )
                startServerService(repo.app)
            }catch (e:Exception){
                Log.e(TAG, e.toString())
            }
        }

    }

    val lastEvent = repo.monkeyEventsDao.getRecent(1)


}