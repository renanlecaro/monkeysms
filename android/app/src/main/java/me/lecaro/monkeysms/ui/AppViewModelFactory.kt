package me.lecaro.monkeysms.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import me.lecaro.monkeysms.data.AppRepository


class AppViewModelFactory(private val repository: AppRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AppViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return AppViewModel(repository) as T
        }
        if (modelClass.isAssignableFrom(ConversationViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return ConversationViewModel(repository) as T
        }
        if (modelClass.isAssignableFrom(ComposeSmsViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return ComposeSmsViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
