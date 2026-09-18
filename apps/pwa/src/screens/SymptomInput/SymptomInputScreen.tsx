import { useState } from "react";
import type { LanguageCode, SymptomCode } from "@mycare/ruleset";
import { ScreenHeader } from "../../components/ScreenHeader.js";
import { Icon } from "../../components/Icon.js";

const CURATED_SYMPTOMS: { code: string; labelKey: string }[] = [
  { code: "fever_mild", labelKey: "quickFever" },
  { code: "cold_cough_no_sob", labelKey: "quickCough" },
  { code: "headache_mild_moderate", labelKey: "quickHeadache" },
  { code: "diarrhea_mild_no_dehydration", labelKey: "quickDiarrhea" },
  { code: "muscle_pain_post_exertion", labelKey: "quickBodyPain" },
];

/**
 * v1's lexiconTerms is empty (packages/ruleset), so free-text resolution
 * currently returns nothing to match against. The curated chips mirror
 * Figure 20 exactly; "browse full symptom list" is a stand-in expander (not
 * in the mockup) so the less-common and severe presentations stay reachable
 * for testing until real lexicon content exists.
 */
export function SymptomInputScreen(props: {
  language: LanguageCode;
  symptomCodes: SymptomCode[];
  onBack: () => void;
  onLanguageClick: () => void;
  onSubmit: (rawText: string, quickSelectedCodes: string[]) => void;
  t: (key: string) => string;
}) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  const curatedCodes = new Set(CURATED_SYMPTOMS.map((s) => s.code));
  const remaining = props.symptomCodes.filter((s) => !curatedCodes.has(s.code));

  return (
    <section className="screen">
      <ScreenHeader onBack={props.onBack} language={props.language} onLanguageClick={props.onLanguageClick} />
      <p className="field-label">{props.t("symptomPrompt")}</p>

      <div className="textarea-wrap">
        <textarea
          className="textarea-input"
          value={text}
          placeholder={props.t("symptomPlaceholder")}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="button" className="mic-button" aria-label="Voice input" disabled>
          <Icon name="mic" size={16} />
        </button>
      </div>

      <div>
        <p className="field-sublabel">{props.t("symptomQuickSelectHint")}</p>
        <div className="chip-row">
          {CURATED_SYMPTOMS.map(({ code, labelKey }) => (
            <button
              key={code}
              type="button"
              className={selected.has(code) ? "chip chip-selected" : "chip"}
              onClick={() => toggle(code)}
            >
              + {props.t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="text-link-button" onClick={() => setShowAll((v) => !v)}>
        {props.t(showAll ? "showLessSymptoms" : "showMoreSymptoms")}
      </button>
      {showAll ? (
        <div className="chip-row">
          {remaining.map((symptom) => (
            <button
              key={symptom.code}
              type="button"
              className={selected.has(symptom.code) ? "chip chip-selected" : "chip"}
              onClick={() => toggle(symptom.code)}
            >
              {symptom.displayName}
            </button>
          ))}
        </div>
      ) : null}

      <span className="spacer" />
      <button
        type="button"
        className="primary-button"
        disabled={text.trim().length === 0 && selected.size === 0}
        onClick={() => props.onSubmit(text, [...selected])}
      >
        {props.t("submit")}
      </button>
      <p className="disclaimer">{props.t("notADiagnosisShort")}</p>
    </section>
  );
}
