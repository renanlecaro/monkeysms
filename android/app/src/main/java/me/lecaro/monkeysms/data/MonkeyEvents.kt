package me.lecaro.monkeysms.data

import androidx.annotation.Keep
import androidx.lifecycle.LiveData
import androidx.room.*


@Keep
@Entity(tableName = "events")
data class MonkeyEvent(
    val text: String,
    var status: String,
    var synced: Boolean = false,
    @PrimaryKey(autoGenerate = true) val id: Long =0,
    val createdAt: Long= System.currentTimeMillis()
)


@Dao
interface MonkeyEventsDao {
    @Query("SELECT * FROM events ORDER BY createdAt DESC LIMIT :limit")
    fun getRecent(limit:Long=100): LiveData<List<MonkeyEvent>>

    @Insert
    suspend fun insert(contact: MonkeyEvent)
}