package me.lecaro.monkeysms.ui

import androidx.lifecycle.*
import kotlinx.coroutines.launch
import me.lecaro.monkeysms.data.AppRepository
import me.lecaro.monkeysms.data.Contact
import me.lecaro.monkeysms.data.createMessage
import me.lecaro.monkeysms.network.startServerService

class ComposeSmsViewModel(val repo: AppRepository) : ViewModel() {
    val suggestions:MutableLiveData<List<Contact>> = MutableLiveData()

    fun search(str:String){
        viewModelScope.launch {
            if(str.length>1){
                suggestions.postValue(repo.contactDao.search("%"+str+"%"))
            }else{
                suggestions.postValue(listOf<Contact>())
            }
        }
    }

      fun send(to:String, text:String){
        viewModelScope.launch {
            val sender = repo.numberThatCanSendTo(to)
            repo.messageDao.upsert(
                createMessage(
                    from = sender.from,
                    to = to,
                    outbound = true,
                    text = text,
                    status = "PENDING",
                    synced = false,
                    deviceId = sender.deviceId
                )
            )

            startServerService(repo.app)
        }
    }


}