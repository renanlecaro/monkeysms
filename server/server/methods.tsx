import { Meteor } from "meteor/meteor";
import {
  Contacts,
  Devices,
  Messages,
  wipeCollections,
} from "/imports/collections";

import { fetch } from "meteor/fetch";
import { escapeRegExp } from "/imports/lib/escapeRegExp";
import crypto from "crypto";
import libphonenumber from "google-libphonenumber";
import { disableKeys } from "./notifyAPIKey";

export const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
export const PNF = libphonenumber.PhoneNumberFormat;

export function randomToken(): Promise<string> {
  return new Promise((resolve, reject) =>
    crypto.randomBytes(48, function (err, buffer) {
      if (err) return reject(err);
      resolve(buffer.toString("hex"));
    })
  );
}

export function getUserDefaultCountryCode(user) {
  return (
    user.profile.defaultCountryCode ||
    Devices.findOne({
      google_user_id: user.google_user_id,
      regionCodes: { $exists: true },
    })?.regionCodes[0] ||
    "FR"
  );
}

function setUserDefaultCountryCode(user, code) {
  code = code.toUpperCase().slice(0, 2);
  Meteor.users.update(user._id, {
    $set: {
      "profile.defaultCountryCode": code,
    },
  });
}

export function deviceToWriteTo(user, to) {
  const google_user_id = user.services.google.id;

  const defaultCountryCode = getUserDefaultCountryCode(user);

  let toNumber;
  try {
    toNumber = phoneUtil.parse(to, defaultCountryCode);
  } catch (e) {
    throw new Meteor.Error("invalid-number", e.message);
  }

  if (!phoneUtil.isValidNumber(toNumber)) {
    throw new Meteor.Error(
      `The phone number ${to} is invalid for ${defaultCountryCode}`
    );
  }

  to = phoneUtil.format(toNumber, PNF.E164);

  const lastSentMessageDeviceId = Messages.findOne(
    {
      google_user_id,
      $or: [
        {
          from: to,
        },
        {
          to,
        },
      ],
      status: { $in: ["RECEIVED", "SENT"] },
    },
    {
      sort: { createdAt: -1 },
    }
  )?.deviceId;

  const device =
    Devices.findOne({
      _id: lastSentMessageDeviceId,
    }) ||
    Devices.findOne(
      {
        google_user_id,
        // TODO do we need to do anything special here ? countryCodes is an array, we want to match if one of its values matches
        countryCodes: toNumber.getCountryCode(),
      },
      { sort: { last_updated: -1 } }
    );

  if (!device) {
    if (Devices.findOne({ google_user_id }))
      throw new Meteor.Error(
        "No user device has the correct sim to send to this country : " +
          toNumber.getCountryCode()
      );
    else throw new Meteor.Error("The user does not have any active device");
  }
  const from = device.userNumbers.find(
    (n) => phoneUtil.parse(n).getCountryCode() == toNumber.getCountryCode()
  );
  return { device, to, from };
}

export async function createMessage({
  rawTo,
  text,
  user,
  source,
  seen = false,
}) {
  const google_user_id = user.services.google.id;
  // check last message to this contact

  if (!rawTo)
    throw new Meteor.Error("*to* parameter missing in the request body.");

  if (!text)
    throw new Meteor.Error("*text* parameter missing in the request body.");

  const { device, to, from } = deviceToWriteTo(user, rawTo);

  const messageId = Messages.insert({
    deviceId: device._id,
    google_user_id,
    from,
    to,
    text,
    outbound: true,
    status: "PENDING",
    createdAt: Date.now(),
    last_updated: Date.now(),
    source,
    seen,
  });

  // If message is sent by device A, device B should still show it in the conversation
  await notifyAllUserDevicesExcept(device.google_user_id);

  return messageId;
}

export async function notifyAllUserDevicesExcept(google_user_id, except = "") {
  await Promise.allSettled(
    Devices.find(
      { google_user_id, _id: { $ne: except } },
      { sort: { last_updated: -1 } }
    ).map((d) => notifyDeviceOfNewMessage(d))
  );
}

Meteor.methods({
  getDeviceForNumber(to) {
    try {
      return deviceToWriteTo(Meteor.user(), to);
    } catch (e) {
      return { error: e.message };
    }
  },
  getUserDefaultCountryCode() {
    return getUserDefaultCountryCode(Meteor.user());
  },
  setUserDefaultCountryCode(code) {
    return setUserDefaultCountryCode(Meteor.user(), code);
  },
  async sendMessage({ to, text }) {
    return await createMessage({
      user: Meteor.user(),
      rawTo: to,
      text,
      // device,
      source: { type: "dashboard" },
      seen: true,
    });
  },
  async notify() {
    const google_user_id = Meteor.user().services.google.id;
    await notifyAllUserDevicesExcept(google_user_id);
    return "ok";
  },
  async "device.disconnect"(_id) {
    const google_user_id = Meteor.user().services.google.id;
    const deviceToDelete = Devices.findOne({
      google_user_id,
      _id,
    });
    Devices.remove(_id);

    // avoids the initial scan duplicating messages
    Messages.remove({ deviceId: _id });

    await notifyDeviceOfNewMessage(deviceToDelete);
    return "Done";
  },
  async "account.delete"() {
    if (!Meteor.user()) return;
    const google_user_id = Meteor.user()?.services.google.id;

    // Notify all keys before deleting them
    await disableKeys(google_user_id, {});
    const devices = Devices.find({ google_user_id }).fetch();

    wipeCollections(google_user_id);

    Meteor.users.remove({ _id: Meteor.userId() });
    // force self clear once device id invalid
    await Promise.all(
      devices.map((device) => notifyDeviceOfNewMessage(device))
    );

    return "Done";
  },
  "contact.search"(search) {
    const escaped = escapeRegExp(search);
    const google_user_id = Meteor.user().services.google.id;
    return Contacts.find(
      {
        google_user_id,
        $or: [
          { name: { $regex: escaped, $options: "i" } },
          { number: { $regex: escaped, $options: "i" } },
        ],
      },
      {
        limit: 20,
        sort: { last_updated: -1 },
      }
    ).fetch();
  },
});

async function notifyDeviceOfNewMessage(device) {
  await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "key=" + Meteor.settings.firebase_key,
    },
    body: JSON.stringify({
      data: { action: "refresh" },
      to: device.FCMToken,
      collapse_key: "refresh",
      priority: "high",
      time_to_live: 5 * 60, // 5 minutes
    }),
  })
    .then((r) => r.json())
    .then((r) => {
      if (r.failure) {
        if (r?.results[0]?.error == "NotRegistered") {
          // we should delete that device probably
          Devices.remove(device._id);
        }
        throw new Meteor.Error(r.results[0].error);
      }
      return r;
    });
}
