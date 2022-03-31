MonkeySMS API documentation
=======================

This page will help you send SMS from your user's phone, using [MonkeySMS](https://monkeysms.com/) as a bridge.

All you need is some basic programming knowledge, our sample code is in javascript, but you can use any technology.
Usage is completely free for now.


Ask your users for access 
----------------------

This is to send SMS using your customer's phone.

To ask a user of your app to send SMSs using their phone, you should send them to our website, passing in some query parameters : 

- `webhook_callback_url` will receive a POST request with a json body containing your API key  
- `redirect_url` is the page the user will be redirected to once the setup is complete

This url should not be localhost:XXXX, as our servers need to be able to reach it. You can use [ngrok](https://ngrok.com/)
to quickly get a public url for development. If you are the main monkeysms app locally, then passing some localhost urls for the webhook and redirect is fine. 

The endpoint at `webhook_callback_url` should handle `POST` requests. It should be specific to the current user. You can
add the user id as part of that url, to then know who the api key belongs to.

Here's how you could ask for a user's key and get the result back as a webhook call

This is where you'll get the login data back as a POST request from us. The currentUser.id is an example of how to get
the user id, adapt the code to your use case.

    var webhook_callback_url="https://mywebsite/webhooks/monkeysms/" + currentUser.id;
    
    var redirect_url="https://mywebsite/confirmation_page"

This is where you should send your users. They'll create an account, install the app, and grant you access.

    var signin_url="https://monkeysms.com/?webhook_callback_url=" + 
        encodeURIComponent(webhook_callback_url) +
        "&redirect_url=" +
        encodeURIComponent(redirect_url);

Send the current user there

    window.location.href=signin_url

Save the API key in your webhook handler
-----------------------------

Once the user grants you access, you'll receive `POST` request on `webhook_callback_url`.

Your `webhook_callback_url` page should :

* parse the json payload containing two keys `event` with the value `access_granted` and `api_key` with your
  user's api key
* check that the `event` matches `"access_granted"` and ignore other requests
* save the `api_key` for the correct user
* return a HTTP status of `200`

Our app will redirect users to that `redirect_url` once the authorisation is completed.

Using the API key to send messages
----------------------------------

Make a `POST` request to `https://monkeysms.com/api/v1/messages` with your API key as a header (x-api-key : XXXXX) and a
JSON encoded body :

    {
        "to":"+33XXXXXXXX",
        "text":"Your SMS text content"
    }

The response will either be 
- a success (HTTP 200) with an empty body 
- a error (HTTP 500) with a JSON response like `{"error":"text description of the error"}"`.

Receive updates about your messages status by webhooks
----------------------------------------------------

Whenever something happens that is relevant to you, you'll be notified by webhook calls

Here are some important events : 
- `access_granted` with a key that just got granted acces to the user's account (the event handled above)
- `message_created` with a `message` key containing the message you just created 
- `message_updated` with a `message` key containing the message that just changed 
- `key_disabled` with a `key` key containing the description of the key that was revoked 

Events may be added in the future, so make sure to just ignore events that don't match known event names, and return a 200 OK