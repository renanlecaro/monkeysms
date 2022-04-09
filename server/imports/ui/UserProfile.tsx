import React, { useEffect, useState } from "react";
import "/imports/ui/UserProfileStyle.less";
import { useTracker } from "meteor/react-meteor-data";
import { ApiKeys, ContactCount } from "../collections";
import { callMethod } from "../lib/callMethod";
import "./notifications";

import { Meteor } from "meteor/meteor";

import { Mongo } from "meteor/mongo";

import { useClientTranslation } from "./i18n";
import { NotificationSettingsSection } from "./notifications";
import { countryCodes } from "../lib/countries";
import { DevModeLink } from "./DeveloperConfigurationScreen";
import { showToast } from "./toast";
import { Table } from "../lib/Table";

const ContactsCount = new Mongo.Collection<ContactCount>("contactsCount");

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
        <Table
          columns={[
            {
              label: "domain",
              value: (key) => key.domain,
            },
            {
              label: "uses",
              value: (key) => key.uses,
              render: (v) => v + " times",
            },
            {
              label: "last used",
              value: (key) => key.lastUsed,
              render: (lastUsed) =>
                lastUsed ? new Date(lastUsed).toLocaleString() : "never",
            },
            {
              label: "Remove",
              value: (key) => key._id,
              render: (_id) => (
                <a
                  href={"#"}
                  onClick={(e) => {
                    e.preventDefault();
                    callMethod("ApiKeys.disable", _id);
                  }}
                >
                  {t("api_keys.remove")}
                </a>
              ),
            },
            {
              label: "Check",
              value: (key) => key._id,
              render: (_id) => (
                <a
                  href={"#"}
                  onClick={(e) => {
                    e.preventDefault();
                    callMethod("ApiKeys.ping", _id).then(
                      () => showToast(t("api_keys.ping_success")),
                      () => showToast(t("api_keys.ping_error", "error"))
                    );
                  }}
                >
                  {t("api_keys.ping")}
                </a>
              ),
            },
          ]}
          rows={userKeys}
        />
      </div>

      <NotificationSettingsSection />
    </div>
  );
}
