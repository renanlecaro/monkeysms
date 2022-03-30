package me.lecaro.monkeysms.ui

import android.content.Context
import androidx.lifecycle.LiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import me.lecaro.monkeysms.R
import me.lecaro.monkeysms.data.AppRepository
import me.lecaro.monkeysms.data.SharedPreferenceStringLiveData
import me.lecaro.monkeysms.network.startServerService

class AppViewModel(private val repo: AppRepository) : ViewModel() {
       val conversations = repo.messageDao.conversations()
    val lastEvent = repo.monkeyEventsDao.getRecent(1)
//   fun getMessagesOfContact(contact: String) = repository.messageDao.getMessagesOfContact(contact).asLiveData()
    fun cancelAll() {
        viewModelScope.launch {
            val count=repo.messageDao.cancelAll(repo.getDeviceIdOrUnknown())
            repo.toast(R.string.toast_all_cancelled,count.toString())
        }
    }
    fun skipOneMessage(){
        viewModelScope.launch {
            val updated=repo.messageDao.retryCurrentMessage(repo.getDeviceIdOrUnknown())
            if(updated>0){
                repo.toast(R.string.toast_retrying,updated.toString())
                startServerService(repo.app)
            }else{
                repo.toast(R.string.toast_no_message_to_resend)
            }

        }
    }

    fun toast(textRessource: Int, vararg formatArgs: String){
        viewModelScope.launch {
             repo.toast(textRessource,*formatArgs)
        }
    }
    val deviceId: LiveData<String> by lazy {
        val sharedPrefs =
            repo.app.getSharedPreferences("me.lecaro.monkeysms", Context.MODE_PRIVATE)
        SharedPreferenceStringLiveData(sharedPrefs, "deviceId", "")
    }
    val lastSync: LiveData<String> by lazy {
        val sharedPrefs =
            repo.app.getSharedPreferences("me.lecaro.monkeysms", Context.MODE_PRIVATE)
        SharedPreferenceStringLiveData(sharedPrefs, "last-sync", "")
    }
    val pendingCount = repo.messageDao.countMessagesInStatus("PENDING")
    val sendingCount = repo.messageDao.countMessagesInStatus("SENDING")
    val messageToSync = repo.messageDao.countNotSynced()
    val contactsToSync = repo.contactDao.countNotSynced()

}
