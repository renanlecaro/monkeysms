// This is the production public key used to sign messages on monkeysms.com.
// If you are using your local instance of monkeySMS, the key signing the
// messages will be different.
const api_public_hook_key =
  "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqFuvCOe2oltiHiy32BKK\nuYAY/tv3fDek+5ePgWUpc/KdC5aK8jUIlRp3ast6iqrDN5G8TfExAr27Ch5xdlfu\nnX9YeUdLYftkG7bgENVobDgnOHXvUQIMq8d1DU2Tyfj/Y9sNCgSCGnhcb4ZzmQpg\n7ukJwKYBhG8rReV24TrZtqeT9AEtrYsUrtFOKMM1BCiSwDmi8y68cEZ3QHxFxhTs\noFt+g0jnNY20dnzSNh4mdNSWweqUF0u0j4usbuzeQZN4aW88k7obv6VCZ2OlHN8x\nEr9+gCetJnSWATyJCDUhhaABEzizfyDs1NMYFMO89Sm4QjxibK0Xj+ldZv0o41i9\ncQIDAQAB\n-----END PUBLIC KEY-----\n";

const port = 4000;

const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const ngrok = require("ngrok");
const crypto = require("crypto");

async function setupApp() {
  let use_local_api;

  // Attempt to check if there's a local dev version of monkeysms running.
  // In your production app, this is not needed, you'd just point to monkeysms.com
  try {
    const res = await fetch("http://localhost:3033/api/monkey_sms_api_version");
    const { version } = await res.json();
    use_local_api = true;
    console.log(
      "Using local monkeySMS instance at localhost:3033, version : " + version
    );
  } catch (e) {
    console.log("Using the main version of the API at monkeysms.com");
    use_local_api = false;
  }

  const api_url = use_local_api
    ? "http://localhost:3033/"
    : "https://monkeysms.com/";

  // We can't have 2 instances of ngrok running on the same machine. If your api is running locally, it is already
  // running ngork. Plus it will be able to reach this app on localhost. So we don't need to use ngork to expose this
  // app to the internet.
  const use_ngrok = !use_local_api;

  // rootUrl is the url of our server on the public internet
  let rootUrl;
  if (use_ngrok) {
    // The ngrok tunnel is required to have a public URL for the webhook callback
    console.info("Starting ngork tunnel");
    rootUrl = await ngrok.connect({ addr: port });
  } else {
    rootUrl = "http://localhost:" + port;
  }

  const webhook_url = rootUrl + "/monkey_sms_callback";
  const redirect_url = rootUrl + "/send_message";
  const app = express();

  // This demo just stores one key in RAM instead of storing one key per user in a DB
  let api_key = null;

  // When the user opens the home page, we check if we have an api key for him
  // (well, we just have one key for everyone in this demo, but that's the idea)
  app.get("/", (req, res) => {
    // no point in showing the authorisation link if we already have a key
    if (api_key) return res.redirect("/send_message");
    // If we don't have a key, we give the user a link to monkeysms.com.
    // This like will tell monkeysms.com that we want a key, and where
    // to send it (webhook_callback_url).
    const authorisationURL =
      api_url +
      "?webhook_callback_url=" +
      encodeURIComponent(webhook_url) +
      "&redirect_url=" +
      encodeURIComponent(redirect_url);
    // We just show that link to the user and let them click it. They'll see a
    // page asking them to log in with google, then install the app on their phone,
    // and finally install the app, at which point our callback url will be called.
    res.set("Content-Type", "text/html");
    res
      .status(200)
      .end(`<a href="${authorisationURL}">Authorize the app</a>${css}`);
  });

  // The json body parser is to parse the POST requests on the webhook endpoint
  // it saves the original  body string in  req.rawBody to check the signature
  app.use(
    bodyParser.json({
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // This is the endpoint that gets the webhook call from monkeysms.com
  app.post("/monkey_sms_callback", (req, res) => {
    console.log(req.body);

    // Check that the payload was sent at the right adress
    if (req.body.webhook_url !== webhook_url) {
      return res
        .status(401)
        .end("Webhook url is not the same as the one we expected");
    }

    // We check the signature of the request, to make sure nobody sent a fake web hook message
    const signature = Buffer.from(req.headers["x-signature"], "hex");
    const verifier = crypto.createVerify("rsa-sha256");
    verifier.update(req.rawBody);
    verifier.end();
    const isVerified = verifier.verify(api_public_hook_key, signature, "hex");
    if (!isVerified) {
      return res.status(401).end("Signature verification failed");
    }

    // There will be more event types in the future
    if (req.body.event === "access_granted") {
      api_key = req.body.api_key;
    }

    if (req.body.event === "key_disabled") {
      api_key = null;
    }

    // Future proof the app, so that it ignores future events
    res.status(200).end("OK");
  });

  // This is just the html code of our form, used in multiple places
  function formHtml({ to = "", text = "" }) {
    // inlining the to and text values like we do it here is a bit dangerous
    // but this text was just written by the user, and it's a demo
    return `<form action="/send_message" method="POST">
        <label for="to">To :</label>
        <input name="to" id="to" type="text" placeholder="+33 6 00 00 00 00" value="${to}"/>
        <label for="text">Text : </label>
        <textarea name="text" id="text" placeholder="Content of your SMS">${text}</textarea>
      <button>Send</button>
    </form>`;
  }

  app.get("/send_message", (req, res) => {
    // No point in trying to send messages without a key
    if (!api_key) return res.redirect("/");

    // just display a form asking for the details of the SMS to send
    res.set("Content-Type", "text/html");
    res.status(200).end(formHtml({ to: "", text: "" }) + css);
  });

  // The url encoded body parser is to parse the POST requests from our SMS form (internal to this demo app)
  app.use(bodyParser.urlencoded({ extended: false }));

  app.post("/send_message", (req, res) => {
    // We get those from our own form
    const { to, text } = req.body;

    // and send them to monkeySMS, with the key
    fetch(api_url + "api/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": api_key,
      },
      body: JSON.stringify({
        to,
        text,
      }),
    })
      .then((res) => res.json())
      // We display the form again, plus the result as a JSON string. We always return a 200 here no matter how the message went
      .then((response) => {
        res
          .status(200)
          .end(
            formHtml(response.error ? { to, text } : { to }) +
              "<pre>" +
              JSON.stringify(response, null, 2) +
              "</pre>" +
              css
          );
      });
  });

  app.listen(port, () => {
    console.log(`Api use example running on  ${rootUrl}`);
  });
}

setupApp().catch(console.error);

// just some styles to make the sample app more readable
const css = `<style>
body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: sans-serif;
} 
form > * {
  display: block;
  width: 300px;
  margin-bottom: 20px;
}
</style>
`;
