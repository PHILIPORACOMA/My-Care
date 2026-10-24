import type { LanguageCode } from "@mycare/ruleset";
import { useMemo, useState } from "react";
import { LANGUAGES, type Translator } from "../i18n";
import type { ChosenBarangay } from "../storage";
import { Icon } from "./Icon";
import { CareMark, LanguagePill, OfflineBadge, Steps } from "./parts";

/** Figure 17, Welcome Page. No login, no registration — one button in. */
export function SplashScreen({ t, onStart }: { t: Translator; onStart: () => void }) {
  return (
    <div className="splash">
      <div className="grow">
        <div className="splash-mark">
          <CareMark size={46} />
        </div>
        <h1 className="splash-word">My Care</h1>
        <p className="splash-tag">{t("tagline")}</p>
      </div>
      <div className="stack">
        <span className="pill pill-ghost self-center">
          <Icon name="check" size={14} />
          {t("worksOffline")} · {t("offlineReady")}
        </span>
        <button className="btn btn-light" onClick={onStart}>
          {t("getStarted")}
        </button>
      </div>
    </div>
  );
}

/** Figure 18, Select Language — step one, so every later screen is in it. */
export function LanguageScreen(props: {
  t: Translator;
  language: LanguageCode;
  onSelect: (language: LanguageCode) => void;
  onContinue: () => void;
}) {
  return (
    <div className="screen">
      <Steps step={1} t={props.t} />
      <div className="grow">
        <h1 className="title">{props.t("chooseLanguage")}</h1>
        <p className="subtitle">{props.t("selectToContinue")}</p>
        <div className="stack stack-top">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              className="choice"
              aria-pressed={props.language === language.code}
              onClick={() => props.onSelect(language.code)}
            >
              {language.label}
              <small>{language.native}</small>
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-dark" onClick={props.onContinue}>
        {props.t("continue")}
      </button>
    </div>
  );
}

/**
 * Figure 19, Select Age — "a mandatory legal checkpoint. My Care is designed
 * for adult users only." Declining records nothing and goes back to the start.
 */
export function AgeScreen(props: {
  t: Translator;
  language: LanguageCode;
  onLanguage: (language: LanguageCode) => void;
  onBack: () => void;
  onConfirm: () => void;
  onDecline: () => void;
}) {
  const [declined, setDeclined] = useState(false);

  // Layout from kizaru3214's age gate (feat/pwa-ui-polish): question and
  // answers grouped mid-screen under a person mark.
  return (
    <div className="screen">
      <div className="top-row">
        <button className="icon-btn" onClick={props.onBack} aria-label={props.t("back")}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className="row-inline">
          <LanguagePill t={props.t} language={props.language} onChange={props.onLanguage} />
          <OfflineBadge t={props.t} />
        </div>
      </div>
      <Steps step={2} t={props.t} />
      <div className="grow age-gate">
        <span className="age-mark" aria-hidden="true">
          <Icon name="user" size={26} />
        </span>
        <h1 className="title title-lg">{props.t("ageQuestion")}</h1>
        <p className="subtitle">{props.t("adultsOnly")}</p>
        {declined && <p className="banner banner-warn">{props.t("ageDeclined")}</p>}
        <div className="stack age-actions">
          <button className="btn" onClick={props.onConfirm}>
            {props.t("yesAdult")}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => {
              setDeclined(true);
              props.onDecline();
            }}
          >
            {props.t("no")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Figure 20, Select Barangay — search or scroll, no GPS, with "Why do we ask?".
 *
 * The list is the server's when the device has fetched it, and the one
 * shipped in the app otherwise (barangays.ts), so it is never empty. Entries
 * are matched by name: a shipped entry has no id until the server confirms it.
 */
export function BarangayScreen(props: {
  t: Translator;
  barangays: ChosenBarangay[];
  selected?: ChosenBarangay;
  onBack: () => void;
  onSelect: (barangay: ChosenBarangay) => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string;
  notice?: string;
  /** Opened from Settings to change barangay, not as onboarding step 3. */
  changing?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [why, setWhy] = useState(false);

  const visible = useMemo(
    () => props.barangays.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())),
    [props.barangays, query]
  );

  return (
    <div className="screen">
      <div className="top-row">
        <button className="icon-btn" onClick={props.onBack} aria-label={props.t("back")}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <OfflineBadge t={props.t} />
      </div>
      {!props.changing && <Steps step={3} t={props.t} />}
      <h1 className="title">{props.t("selectBarangay")}</h1>

      <div className="search">
        <Icon name="search" size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={props.t("searchBarangay")}
          aria-label={props.t("searchBarangay")}
        />
      </div>

      <div className="list">
        {visible.map((barangay) => (
          <button
            key={barangay.name}
            className="choice"
            aria-pressed={props.selected?.name === barangay.name}
            onClick={() => props.onSelect(barangay)}
          >
            {barangay.name}
            <small>{barangay.city}</small>
          </button>
        ))}
      </div>

      {props.notice && <p className="banner banner-warn">{props.notice}</p>}
      {why && <p className="banner">{props.t("whyAskBody")}</p>}
      {props.error && <p className="banner banner-warn">{props.error}</p>}

      <div className="stack stack-top">
        <button className="btn" disabled={!props.selected || props.busy} onClick={props.onConfirm}>
          {props.t("confirmBarangay")}
        </button>
        <button className="btn btn-outline btn-small" onClick={() => setWhy((open) => !open)}>
          {props.t("whyAsk")}
        </button>
      </div>
    </div>
  );
}
