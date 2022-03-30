package me.lecaro.monkeysms.ui

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.provider.ContactsContract
import android.telephony.PhoneNumberUtils
import android.util.Log
import android.view.Menu
import android.view.MenuInflater
import android.view.MenuItem
import android.widget.Toast
import androidx.activity.viewModels
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import me.lecaro.monkeysms.R
import me.lecaro.monkeysms.data.App
import me.lecaro.monkeysms.data.AppRepository
import me.lecaro.monkeysms.data.getOneContactByPhoneNumber
import me.lecaro.monkeysms.databinding.ActivityConversationBinding
import me.lecaro.monkeysms.network.startServerService

class ConversationActivity : AppCompatActivity() {
    val TAG="ConversationActivity"
    private val repo: AppRepository by lazy {
        (application as App).repository
    }
    private val vm: ConversationViewModel by viewModels {
        AppViewModelFactory(repo)
    }
    private lateinit var bindings:ActivityConversationBinding
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val number:String?= getNumber()?.let{
            PhoneNumberUtils.normalizeNumber(it)
        }
        Log.d(TAG, "onCreate found this number : $number "  )
        if(number==null){
            val launchIntent= Intent(this, ComposeSmsActivity::class.java )
            intent.getStringExtra("sms_body")?.let{
                launchIntent.putExtra("sms_body",it)
            }
            this.startActivity(launchIntent)
            this.finish()
        }else{
            vm.setNumber(number)
            contactURI=getOneContactByPhoneNumber( this, vm.contact)
            normalSetup()
        }
        handlePullToRefresh()
    }
    fun  getNumber():String?{
        intent.getStringExtra("address")?.let{
            return it
        }

        intent.data?.let{
            val base = it.schemeSpecificPart
            val position = base.indexOf('?')
            val num= if (position == -1) base else base.substring(0, position)
            if(num!=="") return num
        }


        return null
    }

    fun normalSetup(){

        bindings=ActivityConversationBinding.inflate(
            layoutInflater
        )
        setContentView(bindings.root)
        setupMessageList()
        setupSendForm()
        watchContactName()
    }

    var lastId:String=""
    val conversations_view by lazy {
        findViewById<RecyclerView>(R.id.existing_messages_list)
    }
    val adapter: ConversationListAdapter by lazy {   ConversationListAdapter( this) }
    fun setupMessageList(){

        intent.getStringExtra("sms_body")?.let {
            bindings.newMessageText.text.clear()
            bindings.newMessageText.text.insert(0,it)
        }


        conversations_view.adapter=adapter
        vm.messages.observe(this) {
            adapter.submitList(it)
             it.firstOrNull()?._id?.let{
                if(it!==lastId){
                    conversations_view.scrollToPosition(0);
                }
                lastId=it
            }
            swipeRefreshLayout.isRefreshing=false
        }
    }

    fun setupSendForm(){
        bindings.newMessageSend.setOnClickListener {
            val ti=bindings.newMessageText
            vm.send(ti.text.toString())
            ti.text.clear()
        }
    }

    fun watchContactName(){
        vm.contactName.observe(this){
            setTitle(it)
        }
    }

    var activityMenu:Menu? = null
    var contactURI:Uri? = null
    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        val inflater: MenuInflater = menuInflater
        inflater.inflate(R.menu.conversation, menu)
        activityMenu=menu
        updateMenu()
        return true
    }

    fun updateMenu(){

        if(contactURI!==null){

            activityMenu?.findItem(R.id.menu_see_contact)?.setVisible(true)
            activityMenu?.findItem(R.id.menu_edit_contact)?.setVisible(true)
            activityMenu?.findItem(R.id.menu_create_contact)?.setVisible(false)
        }else{

            activityMenu?.findItem(R.id.menu_see_contact)?.setVisible(false)
            activityMenu?.findItem(R.id.menu_edit_contact)?.setVisible(false)
            activityMenu?.findItem(R.id.menu_create_contact)?.setVisible(true)
        }

    }
    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.menu_see_contact -> {
                val editIntent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(contactURI, ContactsContract.Contacts.CONTENT_ITEM_TYPE)
                    putExtra("finishActivityOnSaveCompleted", true)
                }
                this.startActivity(editIntent)
                true
            }
            R.id.menu_edit_contact -> {
                val editIntent = Intent(Intent.ACTION_EDIT).apply {
                    setDataAndType(contactURI, ContactsContract.Contacts.CONTENT_ITEM_TYPE)
                    putExtra("finishActivityOnSaveCompleted", true)
                }
                this.startActivity(editIntent)
                true
            }
            R.id.menu_create_contact -> {

                val intent = Intent(ContactsContract.Intents.Insert.ACTION)
                intent.type = ContactsContract.RawContacts.CONTENT_TYPE
                intent.putExtra(ContactsContract.Intents.Insert.PHONE, vm.contact)
                this.startActivity(intent)
                true
            }
            else -> super.onOptionsItemSelected(item)
        }

    }

    val swipeRefreshLayout: SwipeRefreshLayout by lazy {
        findViewById(R.id.swipeRefreshLayout)
    }

    fun handlePullToRefresh() {
        swipeRefreshLayout.setOnRefreshListener(SwipeRefreshLayout.OnRefreshListener {
            swipeRefreshLayout.isRefreshing = true
            // call api to reload the screen
            startServerService(this)
        })

        vm.lastSync?.observe(this) {
            swipeRefreshLayout.isRefreshing = false
        }
    }

    override fun onResume() {
        super.onResume()
        vm.clearNotification()
        toastLastEvent()
    }

    var lastLogId:Long?=null
    fun toastLastEvent(){
        lastLogId=null
        vm.lastEvent.observe(this){
            try{
                if(it.isNotEmpty()){
                    if(lastLogId!=null && lastLogId!=it.first().id){
                        Toast.makeText(this, it.first().text, Toast.LENGTH_LONG).show()
                    }
                    lastLogId=it.first().id
                }
            } catch (e:Exception){
                Log.e(TAG, "toastLastEvent", e)
            }

        }
    }

}