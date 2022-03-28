package me.lecaro.monkeysms.data

import androidx.annotation.Keep
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.squareup.moshi.Json
import com.squareup.moshi.ToJson



@Keep
@Entity(tableName = "contact",  indices = [Index(value = ["number"], unique = true)])
data class Contact(
    val number: String,
    var name: String,
    var synced: Boolean = false,
    @PrimaryKey(autoGenerate = true) val id: Int = 0
)
