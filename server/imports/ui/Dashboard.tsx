import React, { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { UserProfile } from "./UserProfile";
import { ConversationUI } from "./Conversation";
import "/imports/ui/DashboardStyle.less";
import { useTracker } from "meteor/react-meteor-data";
import { cleanPhoneNumber, escapeRegExp } from "../lib/escapeRegExp";
import { callMethod } from "../lib/callMethod";
import { useClientTranslation } from "./i18n";
import {
  DeveloperConfigurationScreen,
  DomainInspector,
  SidebarDevLinks,
} from "./DeveloperConfigurationScreen";
import { Mongo } from "meteor/mongo";
import { Conversation, DomainVerifications } from "/imports/collections";

export function Dashboard(props) {
  const { qs } = props;
  // wake up app
  useEffect(() => {
    callMethod("notify");
  }, []);
  const path = qs("path");

  // I should probably use a router here
  const pageContent = (() => {
    if (!path) return <UserProfile {...props} />;
    if (path == "dev") return <DeveloperConfigurationScreen {...props} />;
    if (path.match(/dev\/domain\/.*/))
      return (
        <DomainInspector
          {...props}
          domain={path.replace(/dev\/domain\//gi, "")}
        />
      );

    return <ConversationUI {...props} to={path} />;
  })();

  return (
    <div className={"Dashboard"}>
      <SideBar {...props} />
      <section className={"content"}>{pageContent}</section>
    </div>
  );
}

const Conversations = new Mongo.Collection<Conversation>("conversations");

function SideBar({ user, qs, setQS }) {
  const { t } = useClientTranslation("sidebar");
  const path = qs("path");
  const setPath = (v) => setQS({ path: v });
  const search = qs("search");
  const setSearch = (v) => setQS({ search: v }, true);
  const searchRegexp = new RegExp(`(${escapeRegExp(search)})`, "gi");

  function matchesSearch(text) {
    if (!search) return true;
    if (!text) return false;
    return text.match(searchRegexp);
  }

  useTracker(() => Meteor.subscribe("conversations", search));

  const conversations = useTracker(() =>
    Conversations.find(
      {},
      {
        sort: {
          createdAt: -1,
        },
      }
    ).fetch()
  );

  const [contacts, setContacts] = useState([]);
  useEffect(() => {
    callMethod("contact.search", search).then(setContacts);
  }, [search]);

  const renderedAlready = {};

  function navbarLink(number = "", name = "", text = "") {
    if (!number) return null;
    if (!matchesSearch(number) && !matchesSearch(name)) return null;
    if (renderedAlready[number]) return null;
    renderedAlready[number] = true;
    return (
      <a
        key={number}
        onClick={() => setPath(number)}
        className={path == number ? "active" : ""}
      >
        <strong>
          <HilightText text={name || number} search={search} />
        </strong>
        <em>
          {(name && !search && text && <span>{text}</span>) || (
            <HilightText text={number} search={search} />
          )}
        </em>
      </a>
    );
  }

  return (
    <nav className={"sideNav"}>
      <a onClick={() => setPath("")} className={path === "" ? "active" : ""}>
        <strong>{user.services.google.name}</strong>
        <em> {user.services.google.email}</em>
      </a>
      <SidebarDevLinks {...{ setPath, path }} />
      <div className={"searchBar"}>
        <input
          type={"search"}
          className={search ? "filtering" : ""}
          placeholder={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SearchIcon className={"SearchIcon"} />
        {search ? (
          <CloseIcon className={"CloseIcon"} onClick={() => setSearch("")} />
        ) : null}
      </div>
      {conversations.map((msg) =>
        navbarLink(msg.to, msg.contactName, msg.text)
      )}
      {contacts.map((contact) => navbarLink(contact.number, contact.name, ""))}
      {navbarLink(cleanPhoneNumber(search), "", "")}
    </nav>
  );
}

function SearchIcon(props) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-prefix="fas"
      data-icon="magnifying-glass"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      {...props}
    >
      <path
        fill="currentColor"
        d="M500.3 443.7l-119.7-119.7c27.22-40.41 40.65-90.9 33.46-144.7C401.8 87.79 326.8 13.32 235.2 1.723C99.01-15.51-15.51 99.01 1.724 235.2c11.6 91.64 86.08 166.7 177.6 178.9c53.8 7.189 104.3-6.236 144.7-33.46l119.7 119.7c15.62 15.62 40.95 15.62 56.57 0C515.9 484.7 515.9 459.3 500.3 443.7zM79.1 208c0-70.58 57.42-128 128-128s128 57.42 128 128c0 70.58-57.42 128-128 128S79.1 278.6 79.1 208z"
      ></path>
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-prefix="fas"
      data-icon="xmark"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 512"
      {...props}
    >
      <path
        fill="currentColor"
        d="M310.6 361.4c12.5 12.5 12.5 32.75 0 45.25C304.4 412.9 296.2 416 288 416s-16.38-3.125-22.62-9.375L160 301.3L54.63 406.6C48.38 412.9 40.19 416 32 416S15.63 412.9 9.375 406.6c-12.5-12.5-12.5-32.75 0-45.25l105.4-105.4L9.375 150.6c-12.5-12.5-12.5-32.75 0-45.25s32.75-12.5 45.25 0L160 210.8l105.4-105.4c12.5-12.5 32.75-12.5 45.25 0s12.5 32.75 0 45.25l-105.4 105.4L310.6 361.4z"
      ></path>
    </svg>
  );
}

function HilightText({ text, search }) {
  if (!search || !text) return <span>{text || ""}</span>;
  // Split on search term and include term into parts, ignore case
  const parts = text.split(new RegExp(`(${escapeRegExp(search)})`, "gi"));
  return (
    <>
      {" "}
      {parts.map((part, i) => (
        <span
          key={i}
          className={
            part.toLowerCase() === search.toLowerCase() ? "search-match" : ""
          }
        >
          {part}
        </span>
      ))}{" "}
    </>
  );
}
