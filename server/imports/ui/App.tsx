import { useEffect, useState } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { Devices } from "../collections";
import { Meteor } from "meteor/meteor";
import { HomeScreen } from "./HomeScreen";
import { Dashboard } from "./Dashboard";

import "./App.less";

import {
  AccessRequestScreen,
  installAddress,
  isAndroidDevice,
  shouldShowAccessRequest,
} from "./AccessRequestScreen";
import { useClientTranslation } from "./i18n";
import { InstallApkInstructionScreen } from "./InstallApkInstructionScreen";

function currentPath() {
  const noSlash = window.location.pathname.replace(/^\//, "");
  try {
    return decodeURIComponent(noSlash);
  } catch (e) {
    return noSlash;
  }
}

function parseQS() {
  const queryObj = {
    path: currentPath(),
  };
  window.location.search
    .substring(1)
    .split("&")
    .filter((i) => i)
    .forEach((part) => {
      var pair = part.split("=");
      const key = decodeURIComponent(pair[0]);
      const value = decodeURIComponent(pair[1]);
      if (key && value) queryObj[key] = value;
    });

  return queryObj;
}

function pushQSInState({ path = "", ...searchObj }, replace = false) {
  const search =
    "?" +
    Object.keys(searchObj)
      .map(
        (k) => encodeURIComponent(k) + "=" + encodeURIComponent(searchObj[k])
      )
      .join("&");

  if (window.location.search === search && path === currentPath()) return; // no need to add a step in the stack

  history[replace ? "replaceState" : "pushState"](
    null,
    null,
    "/" + encodeURIComponent(path) + search + location.hash
  );
}

export function usePath(): [
  (path: string) => string,
  (change: Object) => void
] {
  const [qs, setQS] = useState(parseQS());

  useEffect(() => {
    function onPathChange() {
      setQS(parseQS());
    }

    window.addEventListener("popstate", onPathChange);
    return () => window.removeEventListener("popstate", onPathChange);
  });

  return [
    (key): string => qs[key] || "",
    function (changes, replace = false) {
      const newQS = { ...qs, ...changes };

      Object.keys(newQS).forEach((k) => {
        newQS[k] = newQS[k]?.toString() || "";
        if (newQS[k] === "") delete newQS[k];
      });
      setQS(newQS);
      pushQSInState(newQS, replace);
    },
  ];
}

export function App() {
  const [qs, setQS] = usePath();
  const user = useTracker(() => Meteor.user());
  const loggingIn = useTracker(() => Meteor.loggingIn());
  const devices = useTracker(() => Devices.find({}).fetch());

  const screensData = {
    qs,
    setQS,
    user,
    devices,
  };

  if (loggingIn) return null;

  if (qs("path") === "apk") {
    return <InstallApkInstructionScreen />;
  }

  if (shouldShowAccessRequest(screensData))
    return <AccessRequestScreen {...screensData} />;

  if (!user) return <HomeScreen {...screensData} />;
  if (!devices.length && !qs("skip_install_screen")) {
    return <InstallPrompt {...screensData} />;
  }

  return <Dashboard {...screensData} />;
}

export function InstallPrompt({ setQS }) {
  const { t } = useClientTranslation("install_prompt");

  const url = installAddress;

  const skip = (
    <a
      href={"#"}
      onClick={(e) => {
        e.preventDefault();
        setQS({ skip_install_screen: true });
      }}
    >
      {t("skip")}
    </a>
  );
  return (
    <>
      <div className={"InstallPrompt"}>
        <h1>{t("title")}</h1>
        <img src={"/monkey_04.svg"} />

        {isAndroidDevice ? (
          <p>
            <a className={"button"} href={"/apk"} target={"_blank"}>
              {t("install_app")}
            </a>
            {t("or")}
            {skip}
          </p>
        ) : (
          <p>
            {t("open_this")}
            <a href={"/apk"}>{url}</a>
            {t("on_your_phone")}
            {t("or")}
            {skip}
          </p>
        )}
      </div>
    </>
  );
}
