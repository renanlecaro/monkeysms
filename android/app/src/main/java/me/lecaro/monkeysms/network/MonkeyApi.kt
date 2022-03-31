package me.lecaro.monkeysms.network

import android.util.Log
import androidx.annotation.Keep
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import me.lecaro.monkeysms.BuildConfig
import me.lecaro.monkeysms.config
import me.lecaro.monkeysms.data.Contact
import me.lecaro.monkeysms.data.Message
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST


val okHttpClient = OkHttpClient.Builder().apply {
    addInterceptor(
        Interceptor { chain ->
            val builder = chain.request().newBuilder()
            builder.header("x-app-version", "${BuildConfig.VERSION_CODE}")
            return@Interceptor chain.proceed(builder.build())
        }
    )
}.build()

private val moshi = Moshi.Builder()
    .add(KotlinJsonAdapterFactory())
    .build()

private val retrofit = Retrofit.Builder()
    .addConverterFactory(MoshiConverterFactory.create(moshi))
    .baseUrl(config.SERVER_URL)
    .client(okHttpClient)
    .build()


interface Api {

    @POST("api/app/register")
    suspend fun registerApp(@Body params: RegisterAppRequest): RegistrationResult

    @POST("api/app/update_fcm")
    suspend fun updateFCMToken(@Body params: UpdateFCMTokenRequest): String

    @POST("api/app/synchronize")
    suspend fun synchronize(@Body params: SynchronisationParams): SynchronisationResponse

}


@Keep
data class RegisterAppRequest(
    val FCMToken: String,
    val googleLoginToken: String,
    val deviceName: String,
    val androidId: String,
    val userNumbers: List<String>,
)

@Keep
data class UpdateFCMTokenRequest(
    val FCMToken: String,
    val deviceId: String,
    val deviceSecret: String?
)
@Keep
data class RegistrationResult(
    val deviceId: String,
    val deviceSecret:String
)

@Keep
data class SynchronisationParams(
    val deviceId: String,
    val deviceSecret: String?,
    val messages: List<Message>,
    val contacts: List<Contact>,
    val userNumbers: List<String>
)
@Keep
data class SynchronisationResponse(
    val changed: List<Message>?,
    val error: String?,
    val errorCode: String?
)


object MonkeyApi {
    val retrofitService: Api by lazy {
        retrofit.create(Api::class.java)
    }
}

