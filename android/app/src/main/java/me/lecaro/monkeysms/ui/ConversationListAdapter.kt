package me.lecaro.monkeysms.ui
import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.view.updateLayoutParams
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import me.lecaro.monkeysms.data.Message
import me.lecaro.monkeysms.databinding.FragmentMessageItemBinding
import java.text.DateFormat


import java.util.*

class ConversationListAdapter(val context:Context)  : ListAdapter<Message, ConversationListAdapter.MessageViewHolder>(DiffCallback){

    val scale: Float = context.getResources().getDisplayMetrics().density
    val formatter:java.text.DateFormat = (java.text.DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.MEDIUM))!!

    val TAG="ConversationsVLA"
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MessageViewHolder {
        return MessageViewHolder(scale,formatter,
            FragmentMessageItemBinding.inflate(
                LayoutInflater.from(
                    parent.context
                )
            )

        )
    }

    override fun onBindViewHolder(holder: MessageViewHolder, position: Int) {
        val current = getItem(position)
        holder.bind(current)
    }

    class MessageViewHolder( val scale:Float,val formatter: DateFormat, private var binding: FragmentMessageItemBinding) :
        RecyclerView.ViewHolder(binding.root) {
        val TAG="MessageViewHolder"
        val m16 = (16 * scale + 0.5f).toInt()
        val m64 = (64 * scale + 0.5f).toInt()

        fun bind(item: Message) {
            binding.apply {
                val time = Date(item.createdAt)

//                    .ofInstant(
//                    Instant.ofEpochMilli(item.createdAtOnPhone), TimeZone.getDefault().toZoneId())

                messageMetaInfos.text=item.status.toString()+' '+ formatter?.format(time)
                messageTextContent.text=item.text

                messageMetaInfos.updateLayoutParams<ConstraintLayout.LayoutParams> {
                    marginStart=if(item.outbound) m64 else m16
                    marginEnd=if(item.outbound) m16 else m64
                }
                messageTextContent.updateLayoutParams<ConstraintLayout.LayoutParams> {
                    marginStart=if(item.outbound) m64 else m16
                    marginEnd=if(item.outbound) m16 else m64
                }
            }
        }
    }

    companion object {
        private val DiffCallback = object : DiffUtil.ItemCallback<Message>() {
            override fun areItemsTheSame(oldItem: Message, newItem: Message): Boolean {
                return oldItem._id == newItem._id
            }

            override fun areContentsTheSame(oldItem: Message, newItem: Message): Boolean {
                return oldItem== newItem
            }
        }
    }

}