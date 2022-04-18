import React, { useEffect, useState } from "react";
import { useClientTranslation } from "./i18n";
import { useTracker } from "meteor/react-meteor-data";
import { callMethod } from "../lib/callMethod";
import {
  ApiKeys,
  DomainVerification,
  DomainVerifications,
  MonkeyUser,
  WebHookCalls,
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

export function SidebarDevLinks({ path, setPath }) {
  const { t } = useClientTranslation("developper.SidebarDevLink");

  useTracker(() => Meteor.subscribe("domain.list"));
  const domains = useTracker(() =>
    DomainVerifications.find({ status: "verified" }).fetch()
  );

  return (
    <>
      <a
        onClick={() => setPath("dev")}
        className={path === "dev" ? "active" : ""}
      >
        <strong>{t("link")}</strong>

        <em> {t("subtitle")}</em>
      </a>
      {domains.map((domain) => (
        <a
          key={"domain/" + domain.domain}
          onClick={() => setPath("dev/domain/" + domain.domain)}
          className={path === "dev/domain/" + domain.domain ? "active" : ""}
        >
          <strong>{domain.domain}</strong>
          <em> {t("domain_link")}</em>
        </a>
      ))}
    </>
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

export function DomainInspector({ domain }: { domain: string }) {
  const ready = useTracker(
    () =>
      Meteor.subscribe("domain.list", { domain }).ready() &&
      Meteor.subscribe("domain.verified.ApiKeys", { domain }).ready() &&
      Meteor.subscribe("domain.verified.WebHookCalls", { domain }).ready()
  );

  const verification: DomainVerification | null = DomainVerifications.findOne({
    domain,
  });

  const keys = useTracker(() =>
    ApiKeys.find({
      domain,
    }).fetch()
  );
  const webHookCalls = useTracker(() =>
    WebHookCalls.find({
      domain,
    }).fetch()
  );
  if (!ready) return "Loading ..";
  if (!verification) return "You need to verify the domain first";
  if (verification.status != "verified") {
    return "Not verified";
  }

  return (
    <div className={"DomainInspector"}>
      <h1>Domain inspector for {domain}</h1>
      <h2>Keys</h2>
      <Table
        ifEmpty={<p>No api keys for this domain yet</p>}
        columns={[
          {
            label: "_id",
            value: (key) => key._id,
          },
          {
            label: "active",
            value: (key) => key.active,
            render(v) {
              return v ? "Yes" : "No";
            },
          },
          {
            label: "user",
            value: (key) => key.google_user_id,
          },
          {
            label: "webhook_callback_url",
            value: (key) => key.webhook_callback_url,
          },
          {
            label: "createdAt",
            value: (key) => key.createdAt,
            render: (d) => new Date(d).toLocaleString(),
          },
          {
            label: "last_webhook_call",
            value: (key) => key.last_webhook_call,
            render: (d) => new Date(d).toLocaleString(),
          },
          {
            label: "webhook_calls",
            value: (key) => key.webhook_calls,
          },
        ]}
        rows={keys}
      />
      <h2>Webhook calls</h2>

      <Table
        ifEmpty={<p>No webhook calls for this domain yet</p>}
        columns={[
          {
            label: "api_key_id",
            value: (row) => row.api_key_id,
          },
          {
            label: "google_user_id",
            value: (row) => row.google_user_id,
          },
          {
            label: "event",
            value: (row) => row.event,
            render: (event, { data }) => (
              <span title={JSON.stringify(data)}>{event}</span>
            ),
          },

          {
            label: "createdAt",
            value: (key) => key.createdAt,
            render: (d) => new Date(d).toLocaleString(),
          },
          {
            label: "status",
            value: (key) => key.status,
          },
        ]}
        rows={webHookCalls}
      />
      <h2>Verification status</h2>
      <pre>{JSON.stringify(verification, null, 2)}</pre>
    </div>
  );
}
