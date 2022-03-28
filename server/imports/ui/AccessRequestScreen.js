import React, { useEffect, useState } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { ApiKeys } from "../collections";
import { GoogleSignInButton, login } from "./HomeScreen";

import "./HomeScreen.less";
import "./AccessRequestScreen.less";
import { callMethod } from "../lib/callMethod";

export const isAndroidDevice = !!navigator.userAgent.match(/android/gi);
export const installAddress = window.location.host + "/apk";

export function shouldShowAccessRequest({ qs }) {
  return !!getDomain(qs("webhook_callback_url"));
}

function getDomain(url) {
  return url && new URL(url).hostname;
}

export function AccessRequestScreen({ qs, user, devices }) {
  const userEmail = user?.services.google.email;
  const webhook_callback_url = qs("webhook_callback_url");
  const domain = getDomain(webhook_callback_url);
  useEffect(
    () =>
      callMethod("ApiKeys.reGrantAccessIfAlreadyThere", {
        webhook_callback_url,
      }).then(
        (res) =>
          res.redirect_url ? (window.location = res.redirect_url) : null,
        (err) => alert(err.toString())
      ),
    []
  );

  useTracker(() => Meteor.subscribe("ApiKeys"));
  const key = useTracker(() => ApiKeys.findOne({ domain }));

  const steps = [
    {
      image: "monkey_01.svg",
      id: "login",
      done: !!user,
      title: "Login with Google",
      message_todo: "Let us know who you are.",
      message_done: "Connected as " + userEmail,
      action: (
        <GoogleSignInButton
          onClick={(e) => {
            e.preventDefault();
            login();
          }}
        />
      ),
    },
    isAndroidDevice
      ? {
          image: "monkey_02.svg",
          id: "install",
          done: !!devices.length,
          title: "Install the app ",
          message_done: devices[0]?.deviceName + " connected.",
          action: (
            <a className={"button"} href={"/apk"}>
              Get the apk
            </a>
          ),
        }
      : {
          image: "monkey_02.svg",
          id: "install",
          done: !!devices.length,
          title: "Install the app on your phone ",
          message_done: devices[0]?.deviceName + " connected.",

          action: (
            <strong>Open this page on your phone : {installAddress}</strong>
          ),
        },

    {
      image: "monkey_03.svg",
      id: "allow",
      done: !!key,
      title: "Allow " + domain + " to send SMS from your phone",

      message_done: "Access granted",
      action: (
        <button
          onClick={(e) => {
            e.preventDefault();
            callMethod("ApiKeys.grantAccess", {
              domain,
              webhook_callback_url,
            }).then(
              (res) => (window.location = res.redirect_url),
              (err) => alert(err.toString())
            );
          }}
        >
          Grant access
        </button>
      ),
    },
  ];
  const currentStep = steps.find((s) => !s.done) || {
    image: "monkey_04.svg",
    id: "done",
  };

  return (
    <div className={" AccessRequestScreen"}>
      <h1>{domain} would like to send SMS from your phone</h1>
      <img src={currentStep.image} />
      <ol>
        {steps.map(({ done, title, action, message_done, id }, i) => (
          <li
            key={i}
            className={
              (done ? " done" : " todo") +
              (currentStep.id === id ? " current" : " ")
            }
          >
            <p>{title}</p>
            {done ? <p>✓ {message_done}</p> : action}
          </li>
        ))}
      </ol>
      {currentStep.id == "done" ? (
        <p>
          All set, come check out your <a href={"/"}>dashboard</a>
        </p>
      ) : null}
    </div>
  );
}
