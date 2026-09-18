import type { LanguageCode } from "@mycare/ruleset";
import { ProgressBar } from "../../components/ProgressBar.js";
import { ScreenHeader } from "../../components/ScreenHeader.js";
import { Icon } from "../../components/Icon.js";

/**
 * Figure 17: mandatory adult-only checkpoint. "No" exits without recording a
 * session (docs/REPO.md's zero-PII principle) — declining leaves nothing behind.
 */
export function AgeGate(props: {
  language: LanguageCode;
  onBack: () => void;
  onLanguageClick: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  declined: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <section className="screen">
      <ScreenHeader onBack={props.onBack} language={props.language} onLanguageClick={props.onLanguageClick} />
      <ProgressBar step={2} total={3} label={props.t("stepOf", { current: 2, total: 3 })} />
      <span className="icon-badge icon-badge-tint" style={{ width: "3rem", height: "3rem" }}>
        <Icon name="info" size={20} />
      </span>
      <div>
        <p className="field-label">{props.t("ageGateQuestion")}</p>
        <p className="field-sublabel">{props.t("ageGateSubtitle")}</p>
      </div>
      {props.declined ? <p className="disclaimer-card">{props.t("ageGateBlocked")}</p> : null}
      <span className="spacer" />
      <button type="button" className="primary-button" onClick={props.onConfirm}>
        {props.t("ageGateYes")}
      </button>
      <button type="button" className="outline-button" onClick={props.onDecline}>
        {props.t("ageGateNo")}
      </button>
    </section>
  );
}
