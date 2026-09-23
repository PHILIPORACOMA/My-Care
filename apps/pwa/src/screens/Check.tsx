import type { ClarificationQuestion } from "@mycare/ruleset";
import type { SymptomMatch } from "@mycare/lexicon-matcher";
import { useEffect } from "react";
import type { Translator } from "../i18n";
import type { SymptomChoice } from "../triage";
import { CareMark, OfflineBadge } from "./parts";

/**
 * Figure 22, Input Symptom — "two parallel paths: a free-text field and a row
 * of pre-built symptom chips drawn directly from the versioned lexicon. Both
 * produce the same structured output for the triage engine."
 *
 * The design also shows a microphone. It is deliberately absent: no offline
 * speech recogniser exists for Tagalog or Cebuano within the device budget,
 * and the online one would send the patient's voice to a third party, which
 * the privacy model forbids (docs/BUILD-LOG.md).
 */
export function InputScreen(props: {
  t: Translator;
  text: string;
  onText: (text: string) => void;
  chips: SymptomChoice[];
  picked: string[];
  onToggleChip: (code: string) => void;
  matches: SymptomMatch[];
  canContinue: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="screen">
      <div className="top-row">
        <button className="icon-btn" onClick={props.onBack} aria-label={props.t("back")}>
          ←
        </button>
        <OfflineBadge t={props.t} />
      </div>

      <h1 className="title">
        {props.t("whatAreYourSymptoms")}
      </h1>

      <label>
        <span className="sr-only">{props.t("whatAreYourSymptoms")}</span>
        <textarea
          className="textarea"
          value={props.text}
          onChange={(e) => props.onText(e.target.value)}
          placeholder={props.t("symptomPlaceholder")}
          rows={5}
        />
      </label>

      {props.matches.length > 0 && (
        <p className="matches">
          {props.matches.map((m) => `${m.negated ? "✕" : "✓"} ${m.matchedTerm.term}`).join(" · ")}
        </p>
      )}

      <p className="section-label">{props.t("orSelectCommon")}</p>
      {props.chips.length === 0 ? (
        <p className="banner">{props.t("noChipsYet")}</p>
      ) : (
        <div className="chips">
          {props.chips.map((chip) => (
            <button
              key={chip.code}
              className="chip"
              aria-pressed={props.picked.includes(chip.code)}
              onClick={() => props.onToggleChip(chip.code)}
            >
              {props.picked.includes(chip.code) ? "✓ " : "+ "}
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className="push stack">
        {!props.canContinue && <p className="disclaimer">{props.t("noSymptomsYet")}</p>}
        <button className="btn" disabled={!props.canContinue} onClick={props.onContinue}>
          {props.t("continue")}
        </button>
        <p className="disclaimer">{props.t("notADiagnosis")}</p>
      </div>
    </div>
  );
}

/**
 * Figure 23, Severity Clarification — shown only when a matched symptom code
 * carries `needs_clarification`. One question at a time; tapping an answer
 * advances, with no separate Continue button.
 */
export function ClarifyScreen(props: {
  t: Translator;
  question: ClarificationQuestion;
  index: number;
  total: number;
  onBack: () => void;
  onAnswer: (answerIndex: number) => void;
}) {
  return (
    <div className="screen">
      <div className="top-row">
        <button className="icon-btn" onClick={props.onBack} aria-label={props.t("back")}>
          ←
        </button>
        <OfflineBadge t={props.t} />
      </div>

      <div className="steps" aria-hidden="true">
        {Array.from({ length: props.total }, (_, i) => (
          <i key={i} className={i <= props.index ? "on" : undefined} />
        ))}
      </div>

      <p className="note">{props.t("clarifyIntro")}</p>

      <h1 className="title">
        {props.question.prompt}
      </h1>
      <p className="step-label">
        {props.t("questionCounter", { n: props.index + 1, total: props.total })}
      </p>

      <div className="stack">
        {props.question.allowedAnswers.map((answer, index) => (
          <button key={answer} className="choice" onClick={() => props.onAnswer(index)}>
            {answer}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Figure 24, On-device Processing. The engine answers in microseconds; the
 * pause is deliberate, so the patient sees that something was evaluated. It
 * also gives the "On-device analysis" badge time to be read, which is the
 * screen's real job: making clear nothing left the phone.
 */
export function ProcessingScreen({ t, onDone }: { t: Translator; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1100);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="screen">
      <div className="processing">
        <div className="rings">
          <i />
          <i />
          <i />
          <div className="rings-core">
            <CareMark size={34} />
          </div>
        </div>
        <h1 className="title" role="status">
          {t("analyzing")}
        </h1>
        <span className="pill pill-plain">{t("onDeviceAnalysis")}</span>
      </div>
    </div>
  );
}
