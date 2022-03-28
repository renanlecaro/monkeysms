package me.lecaro.monkeysms.ui

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Telephony
import android.util.Log
import android.view.Menu
import android.view.MenuInflater
import android.view.MenuItem
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.common.SignInButton
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.OnCompleteListener
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.firebase.messaging.FirebaseMessaging
import me.lecaro.monkeysms.R
import me.lecaro.monkeysms.config
import me.lecaro.monkeysms.data.App
import me.lecaro.monkeysms.data.AppRepository
import me.lecaro.monkeysms.data.Conversation
import me.lecaro.monkeysms.network.startServerService


class HomeActivity : AppCompatActivity() {
    val TAG = "HomeActivity"


    private val repo: AppRepository by lazy {
        (application as App).repository
    }
    private val vm: AppViewModel by viewModels {
        AppViewModelFactory(repo)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_home)
        setUpButtonListener()
        updateUI()
        setup_conversations_view()
        handlePullToRefresh()
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
    }

    var pendingCount: Int = 0
    var sendingCount: Int = 0

    var messageToSync: Int = 0
    var contactsToSync: Int = 0
    var deviceId: String = "checking"
    var lastSync: String = ""
//    var needsReset = false


    override fun onResume() {
        super.onResume()
        createNotificationChannel()
        updateUI()
//        startServerService(this)
        vm.pendingCount?.observe(this) {
            pendingCount = it
            updateUI()
        }
        vm.sendingCount?.observe(this) {
            sendingCount = it
            updateUI()
        }
        vm.messageToSync?.observe(this) {
            messageToSync = it
            updateUI()
        }
        vm.contactsToSync?.observe(this) {
            contactsToSync = it
            updateUI()
        }
        vm.deviceId?.observe(this) {
            if (deviceId == "checking" && it !== "") {
                startServerService(this)
            }
            deviceId = it
            updateUI()
        }
        vm.lastSync?.observe(this) {
            lastSync = it
            updateUI()
        }
//        vm.needsResetStr?.observe(this) {
//            needsReset = it == "yes"
//            updateUI()
//        }
    }


    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        onResume()
    }


    fun registerChannel(id: String, name: String, description: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                id,
                name,
                NotificationManager.IMPORTANCE_HIGH
            )
            channel.description = description
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotificationChannel() {
        registerChannel(
            config.SERVICE_NOTIFICATION_CHANNEL_ID,
            "Synchronisation service",
            "We need to show a notification to have reliable sync between the app and the server "
        )
        registerChannel(
            config.SMS_NOTIFICATION_CHANNEL_ID,
            "Incoming SMS",
            "Notifies you of incoming SMS"
        )
    }


    val RC_SIGN_IN = 54854
    private fun signIn() {
        val signInIntent = repo.mGoogleSignInClient!!.signInIntent
        startActivityForResult(signInIntent, RC_SIGN_IN)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == RC_SIGN_IN) {
            handleSignInResult(data)
        }

    }

    private fun handleSignInResult(data: Intent?) {
        try {


            val account = GoogleSignIn
                .getSignedInAccountFromIntent(data).getResult(ApiException::class.java)

            // Signed in successfully, show authenticated UI.
            freshlyConnectedAccount = account
            repo.toast(R.string.singin_success, account.email.toString())
            updateUI()
            onLogin(account)
        } catch (e: ApiException) {
            // The ApiException status code indicates the detailed failure reason.
            // Please refer to the GoogleSignInStatusCodes class reference for more information.
            Log.e(TAG, "login failed $e")
            repo.toast(R.string.error_with, "Login", e.toString())
            updateUI()

        }
    }

    override fun onStart() {
        super.onStart()
        updateUI()
    }

    val permissions = mutableListOf<String>(
        android.Manifest.permission.SEND_SMS,
        android.Manifest.permission.READ_SMS,
        android.Manifest.permission.RECEIVE_SMS,
        android.Manifest.permission.RECEIVE_MMS,
        android.Manifest.permission.READ_CONTACTS,
        android.Manifest.permission.WAKE_LOCK,
        android.Manifest.permission.READ_PHONE_STATE,
    )

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            permissions.add(android.Manifest.permission.READ_PHONE_NUMBERS)
        }
    }

    var freshlyConnectedAccount: GoogleSignInAccount? = null

    val roleManager: RoleManager? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getSystemService(RoleManager::class.java)
        } else {
            null
        }
    }

    fun needsToBecomeDefaultSMSProvider(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Log.d(TAG, "needsToBecomeDefaultSMSProvider using Q+ checks")
            val isRoleAvailable = roleManager!!.isRoleAvailable(RoleManager.ROLE_SMS)
            val isRoleHeld = roleManager!!.isRoleHeld(RoleManager.ROLE_SMS)
            Log.d(TAG, "isRoleAvailable $isRoleAvailable")
            Log.d(TAG, "isRoleHeld $isRoleHeld")
            return isRoleAvailable && !isRoleHeld
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {

            Log.d(TAG, "needsToBecomeDefaultSMSProvider using legacy checks")
            val currentHandler = Telephony.Sms.getDefaultSmsPackage(this)
            val thisPackage = this.getPackageName()
            Log.d(TAG, "currentHandler $currentHandler")
            Log.d(TAG, "thisPackage $thisPackage")
            return currentHandler != null && thisPackage != currentHandler
        } else {
            Log.d(TAG, "needsToBecomeDefaultSMSProvider not applicable")
            return false
        }

    }

    fun currentState(): String {

        if (needsToBecomeDefaultSMSProvider()) {
            return "NEEDS_DEFAULT_HANDLER"
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            val missingPerm = permissions.find {
                ContextCompat.checkSelfPermission(
                    this,
                    it
                ) != PackageManager.PERMISSION_GRANTED
            }
            if (missingPerm !== null) {
                return "NEEDS_SEND_SMS"
            } 

        }

        Log.d(TAG, "deviceId : $deviceId")
        if (deviceId == "") return "NEEDS_LOGIN"
        if (sendingCount > 0) return "SENDING"

        if (messageToSync + contactsToSync > 0) {
            return "LOADING"
        }
        return "OK"
    }

    fun updateUI() {
        val illustration = findViewById<ImageView>(R.id.illustration)
        val textTitle = findViewById<TextView>(R.id.textTitle)
        val textDetails = findViewById<TextView>(R.id.textDetails)
        val action = findViewById<Button>(R.id.action)
        val sign_in_button = findViewById<SignInButton>(R.id.sign_in_button)
        val floating_new_conv = findViewById<FloatingActionButton>(R.id.floating_new_conv)

        swipeRefreshLayout.isRefreshing = false

        val state = currentState()
        Log.d(TAG, "updateUI with state : $state")
        when (state) {
            "NEEDS_SEND_SMS" -> {
                illustration.setImageResource(R.drawable.ic_monkey_01)
                textTitle.text = getString(R.string.needs_send_sms_title)
                textDetails.text = getString(R.string.needs_send_sms_details)
                action.text = getString(R.string.needs_send_sms_action)
                action.visibility = View.VISIBLE
                sign_in_button.visibility = View.GONE
                swipeRefreshLayout.visibility = View.GONE
                floating_new_conv.visibility = View.GONE
            }
            "NEEDS_DEFAULT_HANDLER" -> {
                illustration.setImageResource(R.drawable.ic_monkey_03)
                textTitle.text = getString(R.string.needs_default_handler_title)
                textDetails.text = getString(R.string.needs_default_handler_details)
                action.text = getString(R.string.needs_default_handler_action)
                action.visibility = View.VISIBLE
                sign_in_button.visibility = View.GONE
                swipeRefreshLayout.visibility = View.GONE
                floating_new_conv.visibility = View.GONE
            }
            "NEEDS_LOGIN" -> {

                illustration.setImageResource(R.drawable.ic_monkey_04)
                textTitle.text = getString(R.string.needs_login_title)
                textDetails.text = getString(R.string.needs_login_details)
                action.visibility = View.GONE
                sign_in_button.visibility = View.VISIBLE
                swipeRefreshLayout.visibility = View.GONE
                floating_new_conv.visibility = View.GONE
            }
            "OK", "SENDING", "LOADING" -> {

                illustration.visibility = View.GONE
                textTitle.visibility = View.GONE
                textDetails.visibility = View.GONE
                action.visibility = View.GONE
                sign_in_button.visibility = View.GONE
                swipeRefreshLayout.visibility = View.VISIBLE
                floating_new_conv.visibility = View.VISIBLE

            }
        }
        updateMenu()
    }

    fun setUpButtonListener() {
        val action = findViewById<Button>(R.id.action)
        val sign_in_button = findViewById<SignInButton>(R.id.sign_in_button)
        val floating_new_conv = findViewById<FloatingActionButton>(R.id.floating_new_conv)
        sign_in_button.setSize(SignInButton.SIZE_STANDARD);
        sign_in_button.setOnClickListener() {
            signIn()
        }
        floating_new_conv.setOnClickListener() {
            val intent = Intent(this, ComposeSmsActivity::class.java)
            this.startActivity(intent)
        }
        action.setOnClickListener() {

            when (currentState()) {
                "NEEDS_SEND_SMS" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        requestPermissions(
                            permissions.toTypedArray(),
                            config.SMS_PERMISSION_REQUEST_CODE
                        )
                    }
                }
                "NEEDS_DEFAULT_HANDLER" -> {
//                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
//
//                        val roleRequestIntent = roleManager!!.createRequestRoleIntent(
//                            RoleManager.ROLE_SMS
//                        )
//                        startActivityForResult(roleRequestIntent,
//                            config.SMS_PERMISSION_REQUEST_CODE
//                        )
//                    }else{
//
//                        val intent = Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT)
//                        intent.putExtra(
//                            Telephony.Sms.Intents.EXTRA_PACKAGE_NAME,
//                            applicationContext.packageName
//                        )
//                        startActivityForResult(intent, config.SMS_PERMISSION_REQUEST_CODE)
//                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val roleManager = this.getSystemService(RoleManager::class.java)
                        val roleRequestIntent =
                            roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS)
                        startActivityForResult(roleRequestIntent, 666)
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                        val intent = Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT)
                        intent.putExtra(
                            Telephony.Sms.Intents.EXTRA_PACKAGE_NAME,
                            packageName
                        )
                        startActivity(intent)
                    }
                }

            }
        }
    }


    fun onLogin(account: GoogleSignInAccount) {

        FirebaseMessaging.getInstance().token.addOnCompleteListener(OnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w(TAG, "Fetching FCM registration token failed", task.exception)
                return@OnCompleteListener
            }

            // Get new FCM registration tokenFirebaseMessagingService
            val FCMToken = task.result
            val googleLoginToken = account.idToken

            startServerService(this, FCMToken = FCMToken, googleLoginToken = googleLoginToken)
        })
    }

    var activityMenu: Menu? = null
    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        val inflater: MenuInflater = menuInflater
        inflater.inflate(R.menu.connected, menu)
        activityMenu = menu
        return true
    }

    fun updateMenu() {
        val loggedIn = deviceId !== ""
        activityMenu?.findItem(R.id.log_out)?.setVisible(loggedIn)
        activityMenu?.findItem(R.id.open_website)?.setVisible(true)
        activityMenu?.findItem(R.id.menu_sync_now)?.setVisible(loggedIn)
        activityMenu?.findItem(R.id.menu_skip_current_message)?.setVisible(sendingCount > 0)
        activityMenu?.findItem(R.id.menu_cancelAll)?.setVisible(pendingCount + sendingCount > 0)

    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.log_out -> {
                startServerService(this, wipe = true)
                true
            }
            R.id.menu_sync_now -> {
                startServerService(this)
                true
            }
            R.id.open_website -> {
                val browserIntent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(config.SERVER_URL)
                )
                startActivity(browserIntent)
                true
            }

            R.id.menu_skip_current_message -> {

                vm.skipOneMessage()
                true
            }
            R.id.menu_cancelAll -> {

                vm.cancelAll()
                true
            }

            else -> super.onOptionsItemSelected(item)
        }

    }

    val conversations_view by lazy {
        findViewById<RecyclerView>(R.id.conversations_view)
    }
    var lastList: List<Conversation> = listOf<Conversation>()
    val adapter: HomeListAdapter by lazy { HomeListAdapter(this) }
    fun setup_conversations_view() {
        conversations_view.adapter = adapter
        vm.conversations.observe(this) {
            val originalOffset = conversations_view.computeVerticalScrollOffset()
            Log.d(TAG, "isAtTopOfList ${originalOffset}")
            adapter.submitList(it)
            if (originalOffset == 0) {
                // this is to make sure that new conversation show up
                conversations_view.scrollToPosition(0)
                Log.d(TAG, "scrolled to top")
            }
            Log.d(TAG, "list updated ${it.size}")
            lastList = it
            swipeRefreshLayout.isRefreshing = false
        }
    }
}
