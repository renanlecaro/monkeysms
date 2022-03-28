package me.lecaro.monkeysms.ui

import android.content.Context
import android.content.Intent
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import me.lecaro.monkeysms.data.Contact
import me.lecaro.monkeysms.databinding.FragmentContactSuggestionBinding
class ComposeListAdapter(  val callback:(number:String)->Unit)  : ListAdapter<Contact, ComposeListAdapter.ContactViewHolder>(DiffCallback){


    val TAG="ComposeVLA"
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ContactViewHolder {
        return ContactViewHolder(callback,
            FragmentContactSuggestionBinding.inflate(
                LayoutInflater.from(
                    parent.context
                )
            )

        )
    }

    override fun onBindViewHolder(holder: ContactViewHolder, position: Int) {
        val current = getItem(position)
        holder.bind(current)
    }

    class ContactViewHolder(val callback:(number:String)->Unit, private var binding: FragmentContactSuggestionBinding) :
        RecyclerView.ViewHolder(binding.root) {
        val TAG="ComposeVLA"
        var linkTarget=""
        init {
            binding.root.setOnClickListener {
                if(linkTarget!==""){
                    callback(linkTarget)
                }
            }
        }
        fun bind(item: Contact) {
            linkTarget=item.number
            binding.contactName.text=item.name
            binding.contactNumber.text=item.number
        }
    }

    companion object {
        private val DiffCallback = object : DiffUtil.ItemCallback<Contact>() {
            override fun areItemsTheSame(oldItem: Contact, newItem: Contact): Boolean {
                return oldItem.number == newItem.number
            }

            override fun areContentsTheSame(oldItem: Contact, newItem: Contact): Boolean {
                return oldItem== newItem
            }
        }
    }

}