import React, { useState } from "react";
import { Meteor } from "meteor/meteor";
import "./HomeScreen.less";
import { useClientTranslation } from "./i18n";

export function login() {
  Meteor.loginWithGoogle({
    requestPermissions: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    loginStyle: "popup",
  });
}

export function HomeScreen({ user, setPath }) {
  const { t, ParagraphHtml } = useClientTranslation("homepage");
  return (
    <div className={"homePage"}>
      <div className={"appLogo"}>
        <div>{t("appLogo.label")}</div>
      </div>

      <div className={"centeredSlide "}>
        <div>
          <h1>{t("slide_0.title")}</h1>

          <video width="1920" height="1080" controls>
            <source src="/presentation.min.mp4" type="video/mp4" />
            <track
              src="/presentation.min.vtt"
              kind="subtitles"
              srcLang="en"
              label="English"
            />
          </video>
        </div>
      </div>

      <div className={"CTA"}>
        <div>
          <p>{t("cta.text")}</p>

          {user ? (
            <button className={"button"} onClick={(e) => setPath("/profile")}>
              {t("cta.open")}
            </button>
          ) : (
            <button className={"button"} onClick={(e) => login()}>
              {t("cta.login")}
            </button>
          )}
        </div>
      </div>

      <div>
        <div className={"HomePageSlide split "}>
          <img src={"/monkey_03.svg"} />
          <div>
            <h2>{t("slide_1.title")}</h2>
            <ParagraphHtml i18nKey={"slide_1.p0"} />
            <ParagraphHtml i18nKey={"slide_1.p1"} />
          </div>
        </div>
      </div>
      <div>
        <div className={"HomePageSlide split flip"}>
          <img src={"/monkey_01.svg"} />
          <div>
            <h2>{t("slide_2.title")}</h2>
            <ParagraphHtml i18nKey={"slide_2.p0"} />
            <ParagraphHtml i18nKey={"slide_2.p1"} />
          </div>
        </div>
      </div>
      <footer>
        <div>
          <a href={"/about.html"}>{t("footer.about")}</a>
          <a href={"/developers.html"}>{t("footer.api")}</a>
          <a href={"/privacy-policy.html"}>{t("footer.privacy")}</a>
          <a href={"/TOS.html"}>{t("footer.tos")}</a>
        </div>
      </footer>
    </div>
  );
}
