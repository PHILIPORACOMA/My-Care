import type { LanguageCode } from "@mycare/ruleset";
import { ProgressBar } from "../../components/ProgressBar.js";
import { Icon } from "../../components/Icon.js";

const LANGUAGES: { code: LanguageCode; labelKey: string; nativeLabel: string }[] = [
  { code: "en", labelKey: "languageEn", nativeLabel: "English" },
  { code: "tl", labelKey: "languageTl", nativeLabel: "Filipino" },
  { code: "ceb", labelKey: "languageCeb", nativeLabel: "Sugbuanon" },
];

export function LanguageSelect(props: {
  language: LanguageCode;
  onSelect: (language: LanguageCode) => void;
  onNext: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <section className="screen">
      <ProgressBar step={1} total={3} label={props.t("stepOf", { current: 1, total: 3 })} />
      <div style={{ textAlign: "center" }}>
        <span className="icon-badge icon-badge-tint">
          <Icon name="globe" />
        </span>
      </div>
      <div style={{ textAlign: "center" }}>
        <p className="field-label">{props.t("languagePrompt")}</p>
        <p className="field-sublabel">{props.t("languageSubtitle")}</p>
      </div>
      <div className="barangay-list">
        {LANGUAGES.map(({ code, labelKey, nativeLabel }) => (
          <button
            key={code}
            type="button"
            className={code === props.language ? "option-card option-card-selected" : "option-card"}
            onClick={() => props.onSelect(code)}
          >
            <strong>{props.t(labelKey)}</strong>
            <span>{nativeLabel}</span>
          </button>
        ))}
      </div>
      <span className="spacer" />
      <button type="button" className="primary-button" onClick={props.onNext}>
        {props.t("next")}
      </button>
    </section>
  );
}
