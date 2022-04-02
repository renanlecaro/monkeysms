import React, { useEffect, useState } from "react";
import "./UserProfile.less";
import { useTracker } from "meteor/react-meteor-data";
import { ApiKeys } from "../collections";
import { callMethod } from "../lib/callMethod";
import "./notifications";

import { useClientTranslation } from "./i18n";
import { NotificationSettingsSection } from "./notifications";
import { countryCodes } from "../lib/countries";
import { DevModeLink } from "./DeveloperConfigurationScreen";

const ContactsCount = new Mongo.Collection("contactsCount");

export function UserProfile({ user, devices, setQS }) {
  useTracker(() => Meteor.subscribe("contactsCount"));
  let contactsCounter = useTracker(() => ContactsCount.findOne({})?.val || 0);

  useTracker(() => Meteor.subscribe("ApiKeys"));
  const userKeys = useTracker(() =>
    ApiKeys.find({}, { sort: { createdAt: -1 } }).fetch()
  );

  const { t, ParagraphHtml } = useClientTranslation("profile");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [defaultCountry, setDefaultCountry] = useState(null);

  function reloadCountry() {
    return callMethod("getUserDefaultCountryCode").then((v) =>
      setDefaultCountry(v)
    );
  }
  useEffect(() => {
    reloadCountry();
  }, []);
  function changeDefaultCountry(code) {
    setDefaultCountry(code);
    callMethod("setUserDefaultCountryCode", code);
  }
  return (
    <div className={"UserProfile"}>
      <div className={"block"}>
        <h2>{t("account.title")}</h2>

        <p>
          {user.services.google.name} ({user.services.google.email})
        </p>
        <ul>
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                Meteor.logout();
              }}
            >
              {t("account.log_out")}
            </a>
          </li>
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (
                  confirm(
                    "This will erase all message, contacts, and log you out of all phones"
                  )
                ) {
                  callMethod("account.delete");
                }
              }}
            >
              {t("account.delete")}
            </a>
          </li>
        </ul>
      </div>

      <div className={"block"}>
        <h2>{t("defaultCountry.title")}</h2>
        <p>
          {t("defaultCountry.instructions")}
          <select
            value={defaultCountry || ""}
            disabled={!defaultCountry}
            onChange={(e) => changeDefaultCountry(e.target.value)}
          >
            {countryCodes.map((code) => (
              <option value={code} key={code}>
                {code}
              </option>
            ))}
          </select>
        </p>
      </div>

      <div className={"block"}>
        <h2>{t("devices.title")}</h2>
        {devices.length ? (
          <ParagraphHtml i18nKey={"devices.intro"} count={devices.length} />
        ) : (
          <ParagraphHtml i18nKey={"devices.no_device"} />
        )}
        <ul>
          {devices.map((d) => (
            <li key={d._id}>
              {d.deviceName}({" "}
              {d.userNumbers.join(", ") || t("devices.no_number")},{" "}
              {t("devices.last_seen")}{" "}
              {new Date(d.last_connection).toLocaleString()})
              <a
                href={"#"}
                onClick={(e) => {
                  e.preventDefault();
                  callMethod("device.disconnect", d._id);
                }}
              >
                {t("devices.disconnect")}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className={"block"}>
        <h2>{t("contacts.title")}</h2>
        <p>{t("contacts.imported", { count: contactsCounter })}</p>
        <p>{t("contacts.number_needed")}</p>
        <p>{t("contacts.dupes_listed_twice")}</p>
      </div>

      <div className={"block"}>
        <h2>{t("api_keys.title")}</h2>
        <p>{t("api_keys.count", { count: userKeys.length })} </p>
        <DevModeLink setQS={setQS} />
        <ul>
          {userKeys.map((key) => (
            <li key={key._id}>
              {key.domain}, used {key.uses} times, last used{" "}
              {new Date(key.lastUsed).toLocaleString()}
              <a
                href={"#"}
                onClick={(e) => {
                  e.preventDefault();
                  callMethod("ApiKeys.disable", key._id);
                }}
              >
                {t("api_keys.remove")}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <NotificationSettingsSection user={user} />
    </div>
  );
}
