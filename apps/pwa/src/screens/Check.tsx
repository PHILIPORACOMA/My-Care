import type { ClarificationQuestion, LanguageCode } from "@mycare/ruleset";
import type { SymptomMatch } from "@mycare/lexicon-matcher";
import { useEffect, useState } from "react";
import { groupChips } from "../chip-groups";
import type { Translator } from "../i18n";
import type { SymptomChoice } from "../triage";
import { Icon } from "./Icon";
import { CareMark, LanguagePill, OfflineBadge } from "./parts";

/**
 * Figure 22, Input Symptom — "two parallel paths: a free-text field and a row
 * of pre-built symptom chips drawn directly from the versioned lexicon. Both
 * produce the same structured output for the triage engine."
 *
 * The design also shows a microphone. It is shown but does not record: no
 * offline speech recogniser exists for Tagalog or Cebuano within the device
 * budget, and the online one would send the patient's voice to a third party,
 * which the privacy model forbids (docs/BUILD-LOG.md). Tapping it says so.
 */
export function InputScreen(props: {
  t: Translator;
  language: LanguageCode;
  onLanguage: (language: LanguageCode) => void;
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
  const [voiceNote, setVoiceNote] = useState(false);
  const groups = groupChips(props.chips);
  const pickedLabels = props.chips.filter((chip) => props.picked.includes(chip.code)).map((chip) => chip.label);

  return (
    <div className="screen screen-input">
      {/* Design A (BUILD-LOG 9q): a teal header band, the text box overlapping it. */}
      <header className="input-hero">
        <div className="input-hero-inner">
          <div className="top-row">
            <button className="icon-btn icon-btn-round" onClick={props.onBack} aria-label={props.t("back")}>
              <Icon name="chevronLeft" size={18} />
            </button>
            <div className="row-inline">
              <LanguagePill t={props.t} language={props.language} onChange={props.onLanguage} />
              <OfflineBadge t={props.t} />
            </div>
          </div>
          <h1 className="title">{props.t("whatAreYourSymptoms")}</h1>
          <p className="input-hero-lead">{props.t("inputLead")}</p>
        </div>
      </header>

      <div className="input-card">
        <label>
          <span className="sr-only">{props.t("whatAreYourSymptoms")}</span>
          <textarea
            className="textarea"
            value={props.text}
            onChange={(e) => {
              props.onText(e.target.value);
              setVoiceNote(false);
            }}
            placeholder={props.t("symptomPlaceholder")}
            rows={4}
          />
        </label>
        <div className="input-card-foot">
          <span className="input-card-hint">{props.t("languageHint")}</span>
          <button type="button" className="mic-btn" aria-label={props.t("voiceInput")} onClick={() => setVoiceNote(true)}>
            <Icon name="mic" size={20} />
          </button>
        </div>
      </div>
      {voiceNote && (
        <p className="note" role="status">
          {props.t("voiceNotSupported")}
        </p>
      )}

      {props.matches.length > 0 && (
        <p className="matches">
          {props.matches.map((m) => `${m.negated ? "✕" : "✓"} ${m.matchedTerm.term}`).join(" · ")}
        </p>
      )}
      {/* Free text the lexicon does not know yet must not fail silently. */}
      {props.text.trim() !== "" && props.matches.length === 0 && (
        <p className="note" role="status">
          {props.t("noWordsMatched")}
        </p>
      )}

      <p className="section-label">{props.t("orSelectCommon")}</p>
      {props.chips.length === 0 ? (
        <p className="banner">{props.t("noChipsYet")}</p>
      ) : (
        <>
          {/* Shortcuts only: every group below stays open, so no chip is ever
              behind an extra tap. Buttons, not #links, so the URL never changes. */}
          <nav className="area-tiles" aria-label={props.t("jumpToArea")}>
            {groups.map((group) => (
              <button key={group.id} type="button" className="area-tile" onClick={() => jumpTo(group.id)}>
                <span className="area-tile-icon">
                  <Icon name={group.icon} size={19} />
                </span>
                {props.t(group.short)}
              </button>
            ))}
          </nav>
          <div className="chip-groups">
          {groups.map((group) => (
            <section key={group.id} className="chip-group" aria-labelledby={`chip-group-${group.id}`}>
              <h2 className="chip-group-title" id={`chip-group-${group.id}`} tabIndex={-1}>
                <span className="chip-group-icon">
                  <Icon name={group.icon} size={18} />
                </span>
                {props.t(group.label)}
              </h2>
              <div className="chips">
                {group.chips.map((chip) => (
                  <button
                    key={chip.code}
                    className="chip"
                    aria-pressed={props.picked.includes(chip.code)}
                    onClick={() => props.onToggleChip(chip.code)}
                  >
                    <Icon name={props.picked.includes(chip.code) ? "check" : "plus"} size={16} />
                    {chip.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
          </div>
        </>
      )}

      {/* Stays in view while the patient scrolls the groups. */}
      <div className="input-footer">
        <div className="input-footer-inner">
          {pickedLabels.length > 0 && (
            <p className="input-summary" role="status">
              <strong>{props.t("chipsSelected", { n: pickedLabels.length })}</strong> · {pickedLabels.join(" · ")}
            </p>
          )}
          {!props.canContinue && <p className="disclaimer">{props.t("noSymptomsYet")}</p>}
          <button className="btn" disabled={!props.canContinue} onClick={props.onContinue}>
            {props.t("continue")}
          </button>
          <p className="disclaimer">{props.t("notADiagnosis")}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Scrolls to a body-area group and moves focus to its heading, so keyboard and
 * screen-reader users land where sighted users see the page jump to. Smooth
 * only when the patient has not asked for reduced motion.
 */
function jumpTo(groupId: string) {
  const heading = document.getElementById(`chip-group-${groupId}`);
  if (!heading) return;
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  heading.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
  heading.focus({ preventScroll: true });
}

/**
 * Figure 23, Severity Clarification — shown only when a matched symptom code
 * carries `needs_clarification`. One question at a time; tapping an answer
 * advances, with no separate Continue button.
 */
export function ClarifyScreen(props: {
  t: Translator;
  language: LanguageCode;
  onLanguage: (language: LanguageCode) => void;
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
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className="row-inline">
          <LanguagePill t={props.t} language={props.language} onChange={props.onLanguage} />
          <OfflineBadge t={props.t} />
        </div>
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
