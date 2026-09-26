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
      <span className="spacer" />
      <div style={{ textAlign: "center" }}>
        <span className="language-icon-badge">
          <Icon name="globe" size = {30}/>
        </span>
      </div>
      <div style={{ textAlign: "center" }}>
        <p className="field-label language-title">{props.t("languagePrompt")}</p>
        <p className="field-sublabel">{props.t("languageSubtitle")}</p>
      </div>
      <div className="barangay-list">
        {LANGUAGES.map(({ code, labelKey, nativeLabel }) => (
          <button
            key={code}
            type="button"
            className={code === props.language ? "language-card language-card-selected" : "language-card"}
            onClick={() => { props.onSelect(code); props.onNext(); }}
          >
            <strong>{props.t(labelKey)}</strong>
            <span>{nativeLabel}</span>
          </button>
        ))}
      </div>
      <span className="spacer" />
</section>

  );
}
