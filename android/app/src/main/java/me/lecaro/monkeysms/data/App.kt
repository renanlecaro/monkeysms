package me.lecaro.monkeysms.data

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob

class App : Application() {
    val applicationScope = CoroutineScope(SupervisorJob())


    val database: AppDatabase by lazy { AppDatabase.getDatabase(this, applicationScope) }
    val repository by lazy {
        AppRepository(
            database.messageDao(),
            database.contactDao(),
            database.monkeyEventsDao(),
            this
        )
    }

}