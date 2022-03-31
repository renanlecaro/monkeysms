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
  const redirect_url = qs("redirect_url");
  const domain = getDomain(webhook_callback_url);
  const redirectDomain=getDomain(redirect_url);
  const [left, setLeft] = useState(false);

  const monkeyAppDomain = getDomain(Meteor.absoluteUrl());

  useEffect(
    () =>
        // ensures that the app receives the api key again
      callMethod("ApiKeys.reGrantAccessIfAlreadyThere", {
        webhook_callback_url
      }).then(
        (res) => null,
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
      {
          image: "monkey_04.svg",
          id: "redirect",
          done: left,
          title: "Return to  " + redirectDomain,
          message_done: "Openend in new tab",
          action: (
              <a className={"button"} href={redirect_url} onMouseUp={e=>setLeft(true)} onClick={e=>setLeft(true)}>
                  Go back to authorized app
              </a>
          ),
      }
  ];
  const currentStep = steps.find((s) => !s.done) || {
    image: "monkey_04.svg",
    id: "done",
  };
  if(!webhook_callback_url){
     return <div>
          <h1>Error</h1>
         <p>Missing webhook_callback_url query string argument</p>
      </div>
  }
  if(!redirect_url){
     return <div>
          <h1>Error</h1>
         <p>Missing redirect query string argument</p>
      </div>
  }

  if(redirectDomain !== domain){
      return <div>
          <h1>Error</h1>
          The domain of the webhook ({domain}) does not match the domain of the redirect ({redirectDomain})
      </div>
  }

  if(monkeyAppDomain !=='localhost' &&  domain==='localhost'){
      return <div>
          <h1>Error</h1>
          The domain of the webhook ({domain}) should not be localhost, as we won't be able to send webhook calls there from our
          server. Please use something like <a href="https://ngrok.com/">ngrok</a> to create a tunnel to your localhost. This way we'll
          be able to notify your development app of its API key.
      </div>
  }

  return (
    <div className={" AccessRequestScreen"}>
      <h1>{domain} would like to send SMS from your phone</h1>
      <img src={currentStep.image}  alt={"Monkey on his computer"}/>
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
      {currentStep.id === "done" ? (
        <p>
          All set, come check out your <a href={"/"}>dashboard</a>
        </p>
      ) : null}
    </div>
  );
}
