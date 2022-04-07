import "./InstallApkInstructionScreen.less";
import { useClientTranslation } from "./i18n";

export function InstallApkInstructionScreen() {
  const { t, DivHtml } = useClientTranslation("apk");

  return (
    <div className={"InstallApkInstructionScreen"}>
      <a href="/">{t("back_home")}</a>
      <h1>{t("title")}</h1>
      <DivHtml i18nKey={"intro"} />
      <p className={"cta-wrap"}>
        <a className="button" download href="/monkeySMS-v1-release.apk">
          {t("button_label")}
        </a>
      </p>
    </div>
  );
}
