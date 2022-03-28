package me.lecaro.monkeysms.ui

import android.content.Context
import android.content.Intent
import android.util.Log
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import me.lecaro.monkeysms.data.Conversation
import me.lecaro.monkeysms.databinding.FragmentConversationItemBinding


class HomeListAdapter(val context:Context) : ListAdapter<Conversation, HomeListAdapter.MessageViewHolder>(DiffCallback){

    val TAG="ConversationsVLA"
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MessageViewHolder {
        return MessageViewHolder(
            context,
        FragmentConversationItemBinding.inflate(
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


    class MessageViewHolder(private val context:Context, private var binding: FragmentConversationItemBinding) :
        RecyclerView.ViewHolder(binding.root) {
        val TAG="MessageViewHolder"
        var linkTarget=""
        init {
            binding.root.setOnClickListener {
                if(linkTarget!==""){
                    val intent= Intent(context, ConversationActivity::class.java )
                    intent.putExtra("address",linkTarget)
                    context.startActivity(intent)
                }
            }
        }

        fun bind(item: Conversation) {
            linkTarget=item.contact_number
            binding.apply {
                contactName.text=item.name ?: item.contact_number
                lastMessage.text=item.text

                Log.d(TAG, "applied to binding ${item}")
            }
        }
    }

    companion object {
        private val DiffCallback = object : DiffUtil.ItemCallback<Conversation>() {
            override fun areItemsTheSame(oldItem: Conversation, newItem: Conversation): Boolean {
                return oldItem.contact_number == newItem.contact_number
            }

            override fun areContentsTheSame(oldItem: Conversation, newItem: Conversation): Boolean {
                return oldItem== newItem
            }
        }
    }

}