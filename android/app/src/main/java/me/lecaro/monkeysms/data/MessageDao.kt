package me.lecaro.monkeysms.data


import androidx.annotation.Keep
import androidx.lifecycle.LiveData
import androidx.room.*

@Dao
interface MessageDao {
    @Query("SELECT * FROM message WHERE _id = :id")
    suspend fun get(id: String): Message?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(messages: Message)

    @Query("DELETE FROM message")
    suspend fun wipe()

    @Update
    suspend fun _updateExisting(message: Message)

    @Transaction
    suspend fun upsert(message: Message) {

        if (get(message._id) !== null) {
            _updateExisting(message)
        } else {
             insert(message)
        }

    }


    @Query("SELECT * FROM message WHERE deviceId=:deviceId AND status=:status ORDER BY createdAt ASC")
    suspend fun getFirstInStatus(status: String, deviceId:String): Message?

    @Query("UPDATE message SET status='PENDING', synced=0   WHERE status='SENDING' AND deviceId=:deviceId")
    suspend fun retryCurrentMessage(deviceId:String):Int

    @Query("SELECT count(*) FROM message WHERE status=:status")
    fun countMessagesInStatus(status: String): LiveData<Int>?

    @Query("SELECT count(*) FROM message WHERE synced=0")
    fun countNotSynced(): LiveData<Int>?

    @Transaction
    suspend fun nextMessageToSend(deviceId:String): NextSendResult {
        // don't send two at the same time
        if (getFirstInStatus("SENDING",deviceId) !== null)
            return NextSendResult(null, "BUSY")
        val toSend = getFirstInStatus("PENDING",deviceId)
        if (toSend !== null) {
            updateStatus(toSend._id, "SENDING")
            return NextSendResult(toSend, "READY")
        } else {
            return NextSendResult(null, "DONE")
        }
    }

    @Query("UPDATE message SET status ='CANCELLED', synced=0  WHERE status='SENDING' OR  status='PENDING' AND deviceId=:deviceId")
    suspend fun cancelAll(deviceId:String):Int


    @Query("UPDATE message SET status = :newStatus, synced=0  WHERE status=:oldStatus")
    suspend fun updateAllInStatus(oldStatus:String, newStatus:String):Int

    @Query("UPDATE message SET status = :status , synced=0 WHERE _id=:id AND status != :status")
    suspend fun updateStatus(id: String, status: String)

    @Query("SELECT * FROM message  WHERE synced=0 LIMIT 100")
    suspend fun needSync(): List<Message>

    // Don't mark as synced if status changed in between
    @Query("UPDATE message SET synced=1 WHERE _id=:id AND status = :status")
    suspend fun markSynced(id: String, status: String)


    @Query(
        """
WITH recent_messages AS (
                                SELECT   text, createdAt, CASE outbound WHEN 1 THEN msg_to ELSE msg_from END contact_number 
                                FROM message 
                                ORDER BY createdAt ASC 
                              ),
recent_conversations AS (
SELECT contact_number, text,createdAt FROM recent_messages
GROUP BY contact_number LIMIT 100)
SELECT contact_number, text, name from recent_conversations LEFT JOIN contact on contact_number=number ORDER BY createdAt DESC
    """
    )
    fun conversations(): LiveData<List<Conversation>>


    @Query(
        """
      SELECT * FROM message
      WHERE (outbound=1 AND msg_to = :contact) OR (outbound=0 AND msg_from = :contact)  
         ORDER BY createdAt DESC 
         LIMIT 100
    """
    )
    fun messagesWithContact(contact:String): LiveData<List<Message>>


    @Query(
        """
      SELECT * FROM message
      WHERE ((outbound=1 AND msg_to = :contact) OR (outbound=0 AND msg_from = :contact)) AND (status="SENT" OR status="RECEIVED")  
      
         ORDER BY createdAt DESC 
         LIMIT 1
    """
    )
    suspend fun lastMessageForContact(contact: String) : List<Message>
}


@Keep
data class Conversation(val contact_number: String, val text: String, val name:String?)
@Keep
data class NextSendResult(val message: Message?, val status: String)