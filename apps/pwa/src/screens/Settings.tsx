import type { LanguageCode } from "@mycare/ruleset";
import { useState } from "react";
import { LANGUAGES, type Translator } from "../i18n";
import type { CachedBundle } from "../storage";
import { OfflineBadge } from "./parts";

/**
 * Figure 29, Settings — "the two configurable aspects of their session:
 * language and data", plus the offline status card and "Start over".
 */
export function SettingsScreen(props: {
  t: Translator;
  language: LanguageCode;
  bundle?: CachedBundle;
  pending: number;
  lastSyncAt?: string;
  onLanguage: (language: LanguageCode) => void;
  onBack: () => void;
  onStartOver: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const updated = props.bundle
    ? props.t("lastUpdated", {
        when: new Date(props.bundle.fetchedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }),
      })
    : props.t("neverUpdated");

  return (
    <div className="screen">
      <div className="top-row">
        <button className="icon-btn" onClick={props.onBack} aria-label={props.t("back")}>
          ←
        </button>
        <OfflineBadge t={props.t} />
      </div>

      <h1 className="title" style={{ margin: "18px 0 8px" }}>
        {props.t("settings")}
      </h1>

      <p className="row-label">{props.t("language")}</p>
      <div className="segmented">
        {LANGUAGES.map((language) => (
          <button
            key={language.code}
            aria-pressed={props.language === language.code}
            onClick={() => props.onLanguage(language.code)}
          >
            {language.label}
          </button>
        ))}
      </div>

      <p className="row-label">{props.t("dataAndStorage")}</p>
      <div className="rows">
        <div className="row">
          <span>
            ✓ {props.t("worksOffline")}
            <br />
            <span className="subtitle">{updated}</span>
          </span>
          {props.bundle && <span className="pill pill-plain">{props.bundle.versionLabel}</span>}
        </div>
        <div className="row">
          <span>{props.pending > 0 ? props.t("waitingToSend", { count: props.pending }) : props.t("allSent")}</span>
          {props.pending > 0 && <span className="pill">{props.pending}</span>}
        </div>
        <div className="row">
          <span>
            {props.t("aboutMyCare")}
            <br />
            <span className="subtitle">{props.t("aboutBody")}</span>
          </span>
        </div>
      </div>

      <div className="push stack" style={{ marginTop: 16 }}>
        {confirming ? (
          <>
            <p className="banner banner-warn">{props.t("startOverConfirm")}</p>
            <button className="btn btn-danger" onClick={props.onStartOver}>
              {props.t("startOver")}
            </button>
            <button className="btn btn-outline" onClick={() => setConfirming(false)}>
              {props.t("cancel")}
            </button>
          </>
        ) : (
          <button className="btn btn-outline" onClick={() => setConfirming(true)}>
            {props.t("startOver")}
          </button>
        )}
        <p className="disclaimer">{props.t("longDisclaimer")}</p>
      </div>
    </div>
  );
}
