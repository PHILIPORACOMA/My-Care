import type { ClarificationQuestion as ClarificationQuestionModel, LanguageCode } from "@mycare/ruleset";
import { ScreenHeader } from "../../components/ScreenHeader.js";
import { Icon } from "../../components/Icon.js";

/** Figure with "Severity Clarification": auto-advances on tap, no separate Continue button. */
export function ClarificationQuestion(props: {
  language: LanguageCode;
  question: ClarificationQuestionModel;
  current: number;
  total: number;
  onBack: () => void;
  onLanguageClick: () => void;
  onAnswer: (answer: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <section className="screen">
      <ScreenHeader onBack={props.onBack} language={props.language} onLanguageClick={props.onLanguageClick} />
      <div className="disclaimer-card" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
        <Icon name="info" size={16} />
        <span>{props.t("clarificationBanner")}</span>
      </div>
      <p className="field-label">{props.question.prompt}</p>
      <div className="barangay-list">
        {props.question.allowedAnswers.map((answer) => (
          <button key={answer} type="button" className="answer-card" onClick={() => props.onAnswer(answer)}>
            {answer}
          </button>
        ))}
      </div>
      <span className="spacer" />
      <p className="progress-label" style={{ textAlign: "center" }}>
        {props.t("questionOf", { current: props.current, total: props.total })}
      </p>
    </section>
  );
}
