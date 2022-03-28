import { Meteor } from "meteor/meteor";
import { NotificationReceivers } from "../imports/collections";
import webPush from "web-push";

Meteor.publish("NotificationReceivers.all", () => {
  return NotificationReceivers.find({
    google_user_id: Meteor.user()?.services.google.id || "NONO",
  });
});

Meteor.methods({
  async "NotificationReceivers.add"({ content, userDeviceDescription }) {
    console.log("NotificationReceivers.add", {
      content,
      userDeviceDescription,
    });
    const google_user_id = Meteor.user()?.services.google.id;
    const { endpoint } = content;
    NotificationReceivers.insert({
      google_user_id,
      endpoint,
      userDeviceDescription,
      content,
    });
    const sendResult = await notify(content, {
      title: "Test notification",
      tag: "test",
    });
    console.info({ sendResult });
    return "ok";
  },

  "NotificationReceivers.test"(_id) {
    const receiver = NotificationReceivers.findOne({
      google_user_id: Meteor.user()?.services.google.id,
      _id,
    });

    return notify(receiver.content, {
      title: "Test notification",
      tag: "test",
    });
  },
  "NotificationReceivers.remove"(_id) {
    console.log("NotificationReceivers.remove", _id);
    const google_user_id = Meteor.user()?.services.google.id;

    NotificationReceivers.remove({
      google_user_id,
      _id,
    });
  },
});

if (Meteor.settings.public.push_public_key) {
  webPush.setVapidDetails(
    "mailto:renan.lecaro@gmail.com",
    Meteor.settings.public.push_public_key,
    Meteor.settings.push_private_key
  );
}

function notify(receiver, { title, body = "", tag }) {
  if (!Meteor.settings.public.push_public_key)
    return console.log("No notifications set");

  return webPush.sendNotification(
    receiver,
    JSON.stringify({
      title,
      body,
      tag,
      badge: Meteor.absoluteUrl() + "logo-120.png",
      icon: Meteor.absoluteUrl() + "logo-120.png",
      renotify: true,
      requireInteraction: false,
    })
  );
}

export function notifyUser(google_user_id, p) {
  let receivers = NotificationReceivers.find({
    google_user_id,
  }).fetch();
  if (!receivers.length) return;
  return Promise.allSettled(
    receivers.map((receiver) => notify(receiver.content, p))
  );
}
