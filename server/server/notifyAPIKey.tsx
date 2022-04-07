import crypto from "crypto";
import { fetch } from "meteor/fetch";
import { Meteor } from "meteor/meteor";
import { ApiKeys, WebHookCalls } from "/imports/collections";
import { randomToken } from "./methods";

export async function notifyAPIKey(
  { webhook_callback_url, google_user_id, domain, _id },
  event,
  data
) {
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
  const doc = {
    api_key_id: _id,
    domain,
    google_user_id,
    webhook_callback_url,
    event,
    data,
    created_at: Date.now(),
    failures: 0,
    status: "pending",
  };
  doc._id = WebHookCalls.insert(doc);
  await runWebHookCall(doc);
}

const privateKey = Buffer.from(Meteor.settings.hooks_private_key, "utf-8");
function signPayload(body) {
  console.log("signPayload", body, privateKey);
  const signer = crypto.createSign("rsa-sha256");
  signer.update(Buffer.from(body, "utf-8"));
  signer.end();
  return signer.sign(privateKey, "hex").toString("hex");
}
try {
  console.log(signPayload("Hello world"));
} catch (e) {
  console.log(e);
}
async function runWebHookCall({
  _id,
  webhook_callback_url,
  event,
  data,
  failures,
}) {
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
            throw new Meteor.Error(res.status + " : " + err);
          })
    );
    WebHookCalls.update({ _id }, { $set: { status: "done" } });
    console.log("Webhook call done : ", event, data);
  } catch (e) {
    // Exponential backoff, 6 attempts, starting by waiting 16 seconds all the way to 72 hours
    console.log(e);
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
  WebHookCalls._ensureIndex({ created_at: 1 });
  Meteor.setInterval(() => {
    WebHookCalls.find(
      { status: "pending", retry_at: { $gt: Date.now() } },
      { limit: 100, sort: { retry_at: 1 } }
    ).map(runWebHookCall);
  }, 2000);

  Meteor.setInterval(() => {
    // Erase all webhook calls that are older than 30 days , check every hour
    WebHookCalls.remove({
      created_at: { $lt: Date.now() - 30 * 24 * 60 * 60 * 1000 },
    });
  }, 60 * 60 * 1000);
});

Meteor.methods({
  async "ApiKeys.grantAccess"({ domain, webhook_callback_url }) {
    const key = await randomToken();

    const doc = {
      key,
      google_user_id: Meteor.user()?.services.google.id || "NONO",
      domain,
      createdAt: Date.now(),
      uses: 0,
      lastUsed: null,
      active: true,
      webhook_callback_url,
    };
    const _id = ApiKeys.insert(doc);
    if (webhook_callback_url) {
      try {
        return notifyServerOfKey(doc);
      } catch (e) {
        ApiKeys.remove({ _id });
        throw e;
      }
    }
    return { key };
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
      throw new Meteor.Error("not-found");
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
