import React, { useEffect, useState } from "react";
import { useClientTranslation } from "./i18n";
import { useTracker } from "meteor/react-meteor-data";
import { callMethod } from "../lib/callMethod";
import {
  DomainVerification,
  DomainVerifications,
  MonkeyUser,
} from "../collections";
import { txtRecordForUser } from "../lib/txtRecordForUser";
import "/imports/ui/DeveloperConfigurationScreenStyle.less";
import { Table } from "../lib/Table";
import { showToast } from "./toast";
import { Meteor } from "meteor/meteor";

export function DevModeLink({ setQS }) {
  const { t } = useClientTranslation("developper.DevModeLink");

  const user = useTracker(() => Meteor.user()) as MonkeyUser;
  if (user.profile.developper) {
    return <p>{t("done")}</p>;
  }

  return (
    <p>
      {t("label")}
      <a
        href="."
        onClick={(e) => {
          e.preventDefault();
          callMethod("profile.developper.set", true).then(() =>
            setQS({ path: "dev" })
          );
        }}
      >
        {t("action")}
      </a>
    </p>
  );
}

export function SidebarDevLink({ path, setPath }) {
  const { t } = useClientTranslation("developper.SidebarDevLink");

  return (
    <a
      onClick={() => setPath("dev")}
      className={path === "dev" ? "active" : ""}
    >
      <strong>{t("link")}</strong>

      <em> {t("subtitle")}</em>
    </a>
  );
}

export function DeveloperConfigurationScreen() {
  const { t, ParagraphHtml } = useClientTranslation(
    "developper.DevelopperConfigurationScreen"
  );

  return (
    <div className={"UserProfile DeveloperConfigurationScreen"}>
      <div className={"block"}>
        <h1>{t("title")}</h1>
        <ParagraphHtml i18nKey={"intro"} />
      </div>

      <DomainsVerification />
      <HooksSignatureInfo />
    </div>
  );
}

function HooksSignatureInfo() {
  const { t, DivHtml } = useClientTranslation("developper.HooksSignatureInfo");
  return (
    <div className={"block"}>
      <h2>{t("title")}</h2>
      <DivHtml
        i18nKey={"intro"}
        publicKey={Meteor.settings.public.hooks_public_key}
      />
    </div>
  );
}

function DomainsVerification() {
  const { t, DivHtml } = useClientTranslation("developper.DomainsVerification");
  const [toVerify, setToVerify] = useState("");
  useTracker(() => Meteor.subscribe("domain.list"));
  const domains = useTracker(() => DomainVerifications.find().fetch());
  const txtTagRequired = useTracker(
    () => Meteor.user() && txtRecordForUser(Meteor.user().services.google.id)
  );
  return (
    <div className={"block"}>
      <h2>{t("title")}</h2>
      <DivHtml i18nKey={"intro"} txtTagRequired={txtTagRequired} />
      <label htmlFor={"toVerify"}>{t("toVerify.label")}</label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cleaned = toVerify
            .replace(/^https?:\/\//, "")
            .replace(/\/.*/gi, "");

          callMethod("domain.verify.start", cleaned).then(({ verified }) => {
            setToVerify("");
            showToast(
              verified ? t("recheck.worked") : t("recheck.failed"),
              verified ? "success" : "error"
            );
          });
        }}
      >
        <input
          id={"toVerify"}
          type={"text"}
          value={toVerify}
          onChange={(e) => setToVerify(e.target.value)}
          placeholder={t("toVerify.placeholder")}
        />
        <button type={"submit"}>{t("toVerify.action")}</button>
      </form>
      <Table
        columns={[
          {
            label: "Domain",
            value: (domain) => domain.domain,
            render: (domain) => <a href={`https://${domain}`}>{domain}</a>,
          },
          {
            label: "status",
            value: (domain) => domain.status,
            render(status) {
              if (status === "pending") {
                return <span className="pending">{t("status.pending")}</span>;
              }
              if (status === "verified") {
                return <span className="verified">{t("status.verified")}</span>;
              }
              if (status === "error") {
                return <span className="error">{t("status.error")}</span>;
              }
              return status;
            },
          },

          {
            label: t("results.label"),
            render({ error, records }) {
              if (error) return <strong>{error}</strong>;
              if (!records?.length)
                return <strong>{t("results.noRecord")}</strong>;

              return (
                <span title={records.join("\n")}>
                  {t("results.hasRecords", { count: records.length })}{" "}
                </span>
              );
            },
          },

          {
            label: t("recheck.action"),
            value: (domain) => domain._id,
            render(_id) {
              return (
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    const { verified } = await callMethod<DomainVerification>(
                      "domain.verify.recheck",
                      _id
                    );

                    showToast(
                      verified ? t("recheck.worked") : t("recheck.failed"),
                      verified ? "success" : "error"
                    );
                  }}
                >
                  {t("recheck.action")}
                </button>
              );
            },
          },
          {
            label: t("remove.action"),
            value: (domain) => domain._id,
            render(_id) {
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    callMethod("domain.remove", _id);
                  }}
                >
                  {t("remove.action")}
                </button>
              );
            },
          },
        ]}
        rows={domains}
      />
    </div>
  );
}
