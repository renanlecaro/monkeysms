import crypto from "crypto";
import { fetch } from "meteor/fetch";
import { Meteor } from "meteor/meteor";
import {
  ApiKey,
  ApiKeys,
  WebHookCall,
  WebHookCalls,
} from "/imports/collections";
import { randomToken } from "./methods";
import { Buffer } from "buffer";

export async function notifyAPIKey(keyToNotify: ApiKey, event, data) {
  const { webhook_callback_url, google_user_id, domain, _id } = keyToNotify;
  ApiKeys.update(
    { _id },
    {
      $set: {
        last_webhook_call: Date.now(),
      },
      $inc: {
        webhook_calls: 1,
      },
    }
  );
  const doc: WebHookCall = {
    api_key_id: _id,
    domain,
    google_user_id,
    webhook_callback_url,
    event,
    data,
    createdAt: Date.now(),
    failures: 0,
    status: "pending",
    webhook_calls: 0,
  };
  doc._id = WebHookCalls.insert(doc);
  const allowRetry = event !== "ping";
  await runWebHookCall(doc, allowRetry);
}

const privateKey = Meteor.settings.hooks_private_key;

function signPayload(body) {
  console.log("signPayload", body, privateKey);
  const signer = crypto.createSign("rsa-sha256");
  signer.update(Buffer.from(body, "utf-8"));
  signer.end();
  return signer.sign(privateKey, "hex");
}

async function runWebHookCall(call: WebHookCall, allowRetry = true) {
  const { _id, webhook_callback_url, event, data, failures } = call;
  try {
    WebHookCalls.update(
      { _id },
      {
        $set: { status: "running", last_run_at: Date.now() },
        $unset: { retry_at: "" },
      }
    );

    const body = JSON.stringify({
      event,
      ...data,
      // this is so that the event corresponding to one user isn't used for another one
      webhook_url: webhook_callback_url,
    });
    const signature = { "X-Signature": signPayload(body) };

    console.log(
      "sending webhook call to",
      webhook_callback_url,
      body,
      signature
    );
    await fetch(webhook_callback_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...signature,
      },
      body,
    }).then((res) =>
      res.ok
        ? "ok"
        : res.text().then((err) => {
            throw new Meteor.Error("webhook-failure", res.status + " : " + err);
          })
    );
    WebHookCalls.update({ _id }, { $set: { status: "done" } });
    console.log("Webhook call done : ", event, data);
  } catch (e) {
    // Exponential backoff, 6 attempts, starting by waiting 16 seconds all the way to 72 hours
    console.log(e);
    if (!allowRetry) {
      throw new Meteor.Error("notify-api-failed", e.message);
    }

    if (failures >= 7) {
      WebHookCalls.update({ _id }, { $set: { status: "failed" } });
      console.log("Gave up on webhook call  : ", event, data);
    } else {
      WebHookCalls.update(
        { _id },
        {
          $set: {
            retry_at: Date.now() + Math.pow(4, 2 + failures) * 1000,
            last_event: e.message,
            status: "pending",
          },
          $inc: {
            failures: 1,
          },
        }
      );

      console.log("Will retry webhook calls: ", event, data);
    }
  }
}

Meteor.startup(function () {
  WebHookCalls._ensureIndex({ status: 1, retry_at: 1 });
  WebHookCalls._ensureIndex({ createdAt: 1 });
  Meteor.setInterval(async () => {
    const todo = WebHookCalls.find(
      { status: "pending", retry_at: { $gt: Date.now() } },
      { limit: 20, sort: { retry_at: 1 } }
    ).fetch();
    await Promise.all(todo.map((c) => runWebHookCall(c, true)));
  }, 2000);

  Meteor.setInterval(() => {
    // Erase all webhook calls that are older than 30 days , check every hour
    WebHookCalls.remove({
      createdAt: { $lt: Date.now() - 30 * 24 * 60 * 60 * 1000 },
    });
  }, 60 * 60 * 1000);
});

Meteor.methods({
  async "ApiKeys.grantAccess"({ domain, webhook_callback_url }) {
    const key = await randomToken();

    const doc: ApiKey = {
      key,
      google_user_id: Meteor.user()?.services.google.id || "NONO",
      domain,
      createdAt: Date.now(),
      uses: 0,
      lastUsed: null,
      active: true,
      webhook_callback_url,
    };
    doc._id = ApiKeys.insert(doc);
    if (webhook_callback_url) {
      try {
        return notifyServerOfKey(doc);
      } catch (e) {
        ApiKeys.remove({ _id: doc._id });
        throw e;
      }
    }
    return doc;
  },
  async "ApiKeys.reGrantAccessIfAlreadyThere"({ webhook_callback_url }) {
    const existing = ApiKeys.findOne({
      active: true,
      google_user_id: Meteor.user()?.services.google.id || "NONO",
      webhook_callback_url,
    });
    return existing ? notifyServerOfKey(existing) : {};
  },
  async "ApiKeys.disable"(_id) {
    await disableKeys(Meteor.user()?.services.google.id, { _id });
    return "ok";
  },
  async "ApiKeys.ping"(_id) {
    const doc = ApiKeys.findOne({
      _id,
      google_user_id: Meteor.user()?.services.google.id,
    });
    if (!doc) {
      throw new Meteor.Error("not-found", "no key with id " + _id);
    }
    await notifyAPIKey(doc, "ping", {});
    return "ok";
  },
});

export async function disableKeys(google_user_id, filter = {}) {
  if (!google_user_id) return;
  const keys = ApiKeys.find({
    ...filter,
    google_user_id,
    active: true,
  }).fetch();
  await Promise.all(
    keys
      .filter((key) => key.webhook_callback_url)
      .map((key) =>
        notifyAPIKey(key, "key_disabled", { key }).catch((err) =>
          console.warn("Error deleting key", err)
        )
      )
  );
  ApiKeys.update(
    { _id: { $in: keys.map((key) => key._id) } },
    { $set: { active: false } },
    { multi: true }
  );
}

async function notifyServerOfKey(keydoc) {
  return await notifyAPIKey(keydoc, "access_granted", {
    api_key: keydoc.key,
  });
}
