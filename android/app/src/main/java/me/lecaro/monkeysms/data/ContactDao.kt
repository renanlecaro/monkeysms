package me.lecaro.monkeysms.data

import androidx.lifecycle.LiveData
import androidx.room.*

@Dao
interface ContactDao {

    @Query("DELETE FROM contact")
    suspend fun wipe()

    @Query("SELECT * FROM contact WHERE NOT synced LIMIT 100")
    suspend fun needSync(): List<Contact>

    @Query("UPDATE contact SET synced = 1 WHERE number in (:numbers)")
    suspend fun _markSynced(numbers: List<String>)

    @Query("SELECT count(*) FROM contact WHERE synced=0")
    fun countNotSynced(): LiveData<Int>?

    @Transaction
    suspend fun markAllSynced(contacts: List<Contact>) {
        val numbers = contacts.map {
            it.number
        }

        _markSynced(numbers)
    }

    @Query("SELECT * FROM contact WHERE number=:number")
    suspend fun byNumber(number: String): Contact?

    @Update
    suspend fun updateContact(contact: Contact)

    @Insert
    suspend fun insertContact(contact: Contact)

    @Transaction
    suspend fun registerPair(number: String, name: String) {
        var contact = byNumber(number)
        if (contact !== null && contact.name !== name) {
            contact.name = name
            contact.synced = false
            updateContact(contact)
        } else {
            insertContact(Contact(number, name, false))
        }
    }


    @Query("SELECT * FROM contact WHERE name LIKE :search OR number LIKE :search  LIMIT 10")
    suspend fun search(search: String): List<Contact>

}