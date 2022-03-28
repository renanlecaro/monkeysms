const api_url = "https://monkeysms.com/";

const port = 4000;
const local_url = "http://localhost:" + port;

// This demo just stores one key in RAM instead of storing one key per user in a DB
let api_key = null;

const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");

const app = express();
const ngrok = require("ngrok");

// The ngrok tunnel is required to have a public URL for the webhook callback
console.info("Starting ngork tunnel");
ngrok.connect({ addr: port }).then(
  (rootUrl) => {
    console.info("Tunnel started : " + rootUrl);
    // rootUrl is the url of our server on the public internet

    // When the user opens the home page, we check if we have an api key for him
    // (well, we just have one key for everyone in this demo, but that's the idea)
    app.get("/", (req, res) => {
      // no point in showing the authorisation link if we already have a key
      if (api_key) return res.redirect("/send_message");
      // If we don't have a key, we give the user a link to monkeysms.com.
      // This like will tell monkeysms.com that we want a key, and where
      // to send it (webhook_callback_url).
      const webhook_url = rootUrl + "/monkey_sms_callback";
      const authorisationURL =
        api_url + "?webhook_callback_url=" + encodeURIComponent(webhook_url);
      // We just show that link to the user and let them click it. They'll see a
      // page asking them to log in with google, then install the app on their phone,
      // and finally install the app, at which point our callback url will be called.
      res.set("Content-Type", "text/html");
      res
        .status(200)
        .end(`<a href="${authorisationURL}">Authorize the app</a>${css}`);
    });

    // The json body parser is to parse the POST requests on the webhook endpoint
    app.use(bodyParser.json());

    // This is the endpoint that gets the webhook call from monkeysms.com
    app.post("/monkey_sms_callback", (req, res) => {
      console.log(req.body);

      // There will be more event types in the future
      if (req.body.event === "access_granted") {
        api_key = req.body.api_key;
        return res
          .status(200)
          .json({ redirect_url: local_url + "/send_message" });
      }

      // Future proof the app, so that it ignores future events
      res.status(200).end("OK");
    });

    // This is just the html code of our form, used in multiple places
    const formHtml = `<form action="/send_message" method="POST">
        <label for="to">To :</label>
        <input name="to" id="to" type="text" placeholder="+33 6 00 00 00 00"/>
        <label for="text">Text : </label>
        <textarea name="text" id="text" placeholder="Content of your SMS"></textarea>
      <button>Send</button>
    </form>`;

    app.get("/send_message", (req, res) => {
      // No point in trying to send messages without a key
      if (!api_key) return res.redirect("/");

      // just display a form asking for the details of the SMS to send
      res.set("Content-Type", "text/html");
      res.status(200).end(formHtml + css);
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
              formHtml +
                "<pre>" +
                JSON.stringify(response, null, 2) +
                "</pre>" +
                css
            );
        });
    });

    app.listen(port, () => {
      console.log(`Example app running on  ${local_url}`);
    });
  },
  (err) => console.error(err)
);

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
