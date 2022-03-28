package me.lecaro.monkeysms.data

import android.telephony.PhoneNumberUtils
import androidx.annotation.Keep
import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.squareup.moshi.ToJson

fun randomId(): String {
    val charPool: List<Char> = ('a'..'z') + ('A'..'Z') + ('0'..'9')
    return (1..12)
        .map { kotlin.random.Random.nextInt(0, charPool.size) }
        .map(charPool::get)
        .joinToString("");
}

@Keep
@Entity(tableName = "message")
data class Message(
    @PrimaryKey val _id: String = randomId(),
    @ColumnInfo(name = "msg_from") val from: String,
    @ColumnInfo(name = "msg_to") val to: String,
    val outbound: Boolean,
    val text: String,
    var status: String,
    var synced: Boolean = true,
    val deviceId: String,
    // The default arg here is important, as it is used when receiving an update from the server
    var createdAt: Long,
    var seen: Boolean
)


fun createMessage(
    _id: String = randomId(),
    from: String?,
    to: String,
    outbound: Boolean,
    text: String,
    status: String,
    synced: Boolean,
    deviceId:String?,
    createdAt:Long?=null,
    seen:Boolean = false
): Message {
    return Message(
        _id,
        from = if (from==null)  "tbd" else PhoneNumberUtils.normalizeNumber(from),
        to = PhoneNumberUtils.normalizeNumber(to),
        outbound = outbound,
        text = text,
        status = status,
        synced,
        if(deviceId!= null && from!=null) deviceId else "tbd",
        createdAt ?: System.currentTimeMillis(),
        seen
    )
}
