import type { LanguageCode } from "@mycare/ruleset";
import { ScreenHeader } from "../../components/ScreenHeader.js";
import { Icon } from "../../components/Icon.js";

const LANGUAGES: { code: LanguageCode; labelKey: string }[] = [
  { code: "en", labelKey: "languageEn" },
  { code: "tl", labelKey: "languageTl" },
  { code: "ceb", labelKey: "languageCeb" },
];

/** Figure "Settings": language, offline/ruleset status, static info links, and local data reset. */
export function SettingsScreen(props: {
  language: LanguageCode;
  rulesetVersion: string;
  onBack: () => void;
  onLanguageChange: (language: LanguageCode) => void;
  onOpenAbout: () => void;
  onOpenHelp: () => void;
  onStartOver: () => void;
  t: (key: string) => string;
}) {
  return (
    <section className="screen">
      <ScreenHeader onBack={props.onBack} title={props.t("settingsTitle")} />

      <div>
        <p className="settings-section-label">{props.t("languageSectionLabel")}</p>
        <div className="segmented-control">
          {LANGUAGES.map(({ code, labelKey }) => (
            <button
              key={code}
              type="button"
              className={code === props.language ? "segmented-option segmented-option-selected" : "segmented-option"}
              onClick={() => props.onLanguageChange(code)}
            >
              {props.t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="info-card">
        <Icon name="check" size={18} />
        <span>
          <strong>{props.t("worksOffline")}</strong>
          <span>
            {props.t("lastUpdated")}: {props.rulesetVersion}
          </span>
        </span>
      </div>

      <button type="button" className="list-row" onClick={props.onOpenAbout}>
        {props.t("aboutMyCare")}
        <Icon name="chevronRight" size={16} />
      </button>
      <button type="button" className="list-row" onClick={props.onOpenHelp}>
        {props.t("helpDocumentation")}
        <Icon name="chevronRight" size={16} />
      </button>

      <span className="spacer" />
      <button type="button" className="outline-button" onClick={props.onStartOver}>
        {props.t("startOver")}
      </button>
    </section>
  );
}
