import React, {useState} from "react";
import {Meteor} from "meteor/meteor";
import "./HomeScreen.less";
import {useClientTranslation} from "./i18n";

export function GoogleSignInButton() {

    const {t} = useClientTranslation("homepage");
    return <button className={"button"} onClick={(e) => login()}>
        {t("slide_0.login")}
    </button>
}

export function login() {
    Meteor.loginWithGoogle({
        requestPermissions: [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
        loginStyle: "popup",
    });
}

export function HomeScreen({user, setPath}) {
    const {t, ParagraphHtml} = useClientTranslation("homepage");
    return (
        <div className={"homePage"}>
            <div>
                <div className={"HomePageSlide split "}>
                    <img src={"/monkey_03.svg"}/>
                    <div>
                        <h2>{t("slide_0.title")}</h2>
                        <ParagraphHtml i18nKey={"slide_0.p0"}/>
                        <ParagraphHtml i18nKey={"slide_0.p1"}/>
                        {user ? (
                            <button className={"button"} onClick={(e) => setPath("/profile")}>
                                {t("slide_0.open")}
                            </button>
                        ) : (
                            <GoogleSignInButton/>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <div className={"HomePageSlide split flip"}>
                    <img src={"/monkey_01.svg"}/>
                    <div>
                        <h2>{t("slide_1.title")}</h2>
                        <ParagraphHtml i18nKey={"slide_1.p0"}/>
                        <ParagraphHtml i18nKey={"slide_1.p1"}/>
                        <a className={"button"} href={"https://github.com/renanlecaro/monkeysms/tree/main/api_use_example"} target={"_blank"}>
                            {t("slide_1.action")}
                        </a>
                    </div>
                </div>
            </div>
            <div>
                <div className={"HomePageSlide split "}>
                    <img src={"/monkey_04.svg"}/>
                    <div>
                        <h2>{t("slide_2.title")}</h2>
                        <ParagraphHtml i18nKey={"slide_2.p0"}/>
                        <ParagraphHtml i18nKey={"slide_2.p1"}/>
                        <a
                            className={"button"}
                            href={"https://github.com/renanlecaro/monkeysms"}
                            target={"_blank"}
                        >
                            {t("slide_2.action")}
                        </a>
                    </div>
                </div>
            </div>
            <footer>
                <div>
                    <a href={"/about.html"}>{t("footer.about")}</a>
                    <a href={"https://github.com/renanlecaro/monkeysms/tree/main/api_use_example"}>{t("footer.api")}</a>
                    <a href={"/privacy-policy.html"}>{t("footer.privacy")}</a>
                    <a href={"/TOS.html"}>{t("footer.tos")}</a>
                </div>
            </footer>
        </div>
    );
}
