import React, { useState, useEffect } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { NotificationReceivers } from "../collections";
import { callMethod } from "../lib/callMethod";
import { useClientTranslation } from "./i18n";

const swRegistration = new ReactiveVar(null);
const localSub = new ReactiveVar(null);

if ("serviceWorker" in navigator && "PushManager" in window) {
  console.log("Service Worker and Push is supported");

  navigator.serviceWorker
    .register("sw-messages-notifications.js")
    .then(function (swReg) {
      console.log("Service Worker is registered", swReg);
      swRegistration.set({ result: swReg });
    })
    .catch(function (error) {
      console.error("Service Worker Error", error);
      swRegistration.set({ error });
    });
} else {
  console.warn("Push messaging is not supported");
  swRegistration.set({ error: "Push messaging is not supported" });
}

export function NotificationSettingsSection({}) {
  useEffect(
    () =>
      swRegistration
        .get()
        .result.pushManager.getSubscription()
        .then((s) => localSub.set(s)),
    []
  );

  useTracker(() => Meteor.subscribe("NotificationReceivers.all"));
  const subs = useTracker(() => NotificationReceivers.find({}).fetch());
  const activeLocalSub = subs.find(
    (s) => s.endpoint === localSub.get()?.endpoint
  );
  const { t } = useClientTranslation("profile");

  return (
    <div className={"block"}>
      <h2>{t("notifications.title")}</h2>
      <p>{t("notifications.intro")}</p>

      <ul>
        {subs.map((s, i) => (
          <li key={i}>
            {s.userDeviceDescription}
            {" : "}
            <a
              href={"#"}
              onClick={(e) => {
                e.preventDefault();
                callMethod("NotificationReceivers.remove", s._id);
              }}
            >
              {t("notifications.delete_device")}
            </a>{" "}
            or{" "}
            <a
              href={"#"}
              onClick={(e) => {
                e.preventDefault();
                callMethod("NotificationReceivers.test", s._id);
              }}
            >
              {t("notifications.test_device")}
            </a>
          </li>
        ))}
      </ul>
      <NotifyHereButton activeLocalSub={activeLocalSub} />
    </div>
  );
}

function addReceiver(sub) {
  const content = JSON.parse(JSON.stringify(sub));
  return callMethod("NotificationReceivers.add", {
    content,
    userDeviceDescription,
  });
}

function NotifyHereButton({ activeLocalSub }) {
  const { result, error } = useTracker(() => swRegistration.get() || {});
  const unusedSub = useTracker(() => !activeLocalSub && localSub.get()?.result);
  const { t } = useClientTranslation("profile");

  if (error) return t("notifications.error", { error: error.toString() });
  if (!result) return t("notifications.loading");
  if (Notification.permission === "denied") {
    return t("notifications.blocked");
  }
  if (activeLocalSub) return null;

  return (
    <button
      className={"button"}
      onClick={(e) => {
        e.preventDefault();
        if (unusedSub) {
          return addReceiver(unusedSub);
        }

        subscribeUser().then((sub) => addReceiver(sub));
      }}
    >
      {t("notifications.enable")}
    </button>
  );
}

const applicationServerPublicKey = Meteor.settings.public.push_public_key;

function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function subscribeUser() {
  const applicationServerKey = urlB64ToUint8Array(applicationServerPublicKey);
  return swRegistration
    .get()
    .result.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    })
    .then(
      (sub) => {
        localSub.set(sub);
        return sub;
      },
      (err) => console.error(err)
    );
}

let userDeviceDescription = "Unknown device";
fetch("/user_agent")
  .then((res) => res.json())
  .then((d) => {
    userDeviceDescription =
      d.client.name +
      " on " +
      d.os.name +
      " (" +
      Object.values(d.device)
        .filter((i) => i)
        .join(" ") +
      ")";
    console.log(userDeviceDescription);
  });
