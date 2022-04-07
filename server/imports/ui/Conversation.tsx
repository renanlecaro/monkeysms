import { useTracker } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";
import { Messages } from "../collections";
import { useEffect, useState } from "react";
import "./Conversation.less";
import { callMethod } from "../lib/callMethod";
import Linkify from "react-linkify";
import { useClientTranslation } from "./i18n";

export function WriteForm({ to }) {
  const { t } = useClientTranslation("WriteForm");
  const [text, setText] = useState("");

  const [from, setFrom] = useState(null);
  const [toFormatted, setToFormatted] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    callMethod("getDeviceForNumber", to).then(({ error, to, from }) => {
      if (error) {
        setErr(error);
      } else {
        setFrom(from);
        setToFormatted(to);
      }
    });
  }, [to]);

  function submit(e) {
    e?.preventDefault();
    if (!text) return;
    callMethod("sendMessage", { to, text });
    setText("");
  }

  return (
    <form onSubmit={submit}>
      <textarea
        disabled={!!err}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.which === 13) {
            e.preventDefault();
            submit(e);
          }
        }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={err || t("input_placeholder", { from, toFormatted })}
      />
      <button className={"button"} disabled={!text}>
        {t("send")}
      </button>
    </form>
  );
}

export function ConversationUI({ to }) {
  useTracker(() => Meteor.subscribe("lastMessages", to));
  const messages = useTracker(() =>
    Messages.find(
      {
        $or: [
          { to, outbound: true },
          { from: to, outbound: false },
        ],
      },
      { sort: { createdAt: 1 } }
    ).fetch()
  );
  useEffect(() => {
    console.log("Scrolling to bottom");
    window.scrollTo(0, document.body.scrollHeight - window.innerHeight);
  }, [messages[messages.length - 1]?._id || "noMessages", to]);
  return (
    <div className={"Conversation"}>
      <div className={"messageList"}>
        {messages.map((message) => (
          <div
            key={message._id}
            className={
              "message " +
              (message.outbound ? "outbound" : "inbound") +
              " " +
              message.status
            }
          >
            <div
              className={"message-meta-info"}
              title={"Full message infos : " + JSON.stringify(message, null, 2)}
            >
              <span className={"message-time"}>
                {new Date(message.createdAt).toLocaleString()}
              </span>{" "}
              -<span className={"message-status"}>{message.status}</span>
            </div>

            <div className={"message-text"}>
              <Linkify
                componentDecorator={(decoratedHref, decoratedText, key) => (
                  <a target="blank" href={decoratedHref} key={key}>
                    {decoratedText}
                  </a>
                )}
              >
                {message.text}
              </Linkify>
            </div>
          </div>
        ))}
      </div>
      <WriteForm to={to} />
    </div>
  );
}
