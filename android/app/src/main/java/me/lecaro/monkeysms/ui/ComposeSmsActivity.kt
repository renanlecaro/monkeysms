package me.lecaro.monkeysms.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.doAfterTextChanged
import androidx.core.widget.doOnTextChanged
import com.google.android.material.textfield.TextInputEditText
import me.lecaro.monkeysms.data.App
import me.lecaro.monkeysms.data.AppRepository
import me.lecaro.monkeysms.databinding.ActivityComposeBinding

class ComposeSmsActivity : AppCompatActivity() {
    val TAG="ComposeSmsActivity"


    private val repo: AppRepository by lazy {
        (application as App).repository
    }
    private val vm: ComposeSmsViewModel by viewModels {
        AppViewModelFactory(repo)
    }

    private lateinit var bindings: ActivityComposeBinding
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        bindings= ActivityComposeBinding.inflate(
            layoutInflater
        )
        setContentView(bindings.root)
        setupForm()
        intent.getStringExtra("sms_body")?.let{
            bindings.composeSmsTextInput.text.clear()
            bindings.composeSmsTextInput.text.insert(0, it)
        }
        setupContactSearch()
    }

    fun setErrorText(err:String?){
        bindings.errorInfo.text= err  ?: ""
    }

    fun getPhone():String{
       return bindings.composeSmsNumberInput.text.toString()
    }
    fun getBody():String{
       return bindings.composeSmsTextInput.text.toString()
    }
    fun setupForm(){
        setErrorText(null)
        bindings.composeSmsSendButton.setOnClickListener {
            val to=getPhone()
            val text=getBody()
            if(to=="") setErrorText("Missing number")
            else if(text=="") setErrorText("Missing text")
            else {
                    try{

                        vm.send(to, text)

                        val intent= Intent(this, ConversationActivity::class.java )
                        intent.putExtra("address",to)
                        this.startActivity(intent)
                    }catch (e:Exception){
                        setErrorText("$e")
                    }

            }
        }
    }

    val adapter:ComposeListAdapter by lazy{
        ComposeListAdapter() {


            // set the view up in case of going back to it
            bindings.composeSmsNumberInput.text.clear()
            bindings.composeSmsNumberInput.text.append(it)
            bindings.contactSuggestions.visibility= View.GONE
            bindings.composeSmsTextInput.requestFocus()
        }
    }
    fun setupContactSearch(){
        bindings.contactSuggestions.adapter=adapter
        bindings.contactSuggestions.visibility= View.GONE
        vm.suggestions.observe(this, {
            adapter.submitList(it)
        })
        bindings.composeSmsNumberInput.setOnFocusChangeListener { view, b ->
            Log.d(TAG, "focus : $b")
            bindings.contactSuggestions.visibility= if(b) View.VISIBLE else View.GONE
        }
        bindings.composeSmsNumberInput.doAfterTextChanged {
            val search=it.toString()
            Log.d(TAG, "seach : $search")
            vm.search(search)

        }


    }

}