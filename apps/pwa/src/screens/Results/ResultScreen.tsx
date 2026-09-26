import type { LanguageCode, SymptomCode, Tier } from "@mycare/ruleset";
import { LANGUAGE_NAME } from "../../components/ScreenHeader.js";
import { Icon, type IconName } from "../../components/Icon.js";
import { shortLabel } from "../../lib/shortLabel.js";

const TIER_CONFIG: Record<Tier, { className: string; icon: IconName; titleKey: string; bodyKey: string }> = {
  home: { className: "result-tier-home", icon: "home", titleKey: "resultHomeTitle", bodyKey: "resultHomeBody" },
  rhu: { className: "result-tier-rhu", icon: "clinic", titleKey: "resultRhuTitle", bodyKey: "resultRhuBody" },
  emergency: {
    className: "result-tier-emergency",
    icon: "heartbeat",
    titleKey: "resultEmergencyTitle",
    bodyKey: "resultEmergencyBody",
  },
};

const EMERGENCY_HOTLINE = "911"; // Placeholder — swap for the barangay-specific hotline once that data exists.

/** Figures "Result - Green/Amber/Red": doubles as a paper-free referral slip (README). */
export function ResultScreen(props: {
  tier: Tier;
  language: LanguageCode;
  matchedSymptomCodes: string[];
  symptomCodes: SymptomCode[];
  onViewHealthTips: () => void;
  onCheckAgain: () => void;
  t: (key: string) => string;
}) {
  const config = TIER_CONFIG[props.tier];
  const byCode = new Map(props.symptomCodes.map((s) => [s.code, s.displayName]));

  return (
    <section className={`result-screen ${config.className}`}>
      <div className="result-header">
  <span className="pill chip-static"><Icon name="globe" size={14} />{LANGUAGE_NAME[props.language]}</span>
</div>
        <div className="result-body">
        <span className="icon-badge">
          <Icon name={config.icon} size={30} />
        </span>
        <h1>{props.t(config.titleKey)}</h1>
        <div className="chip-row" style={{ justifyContent: "center" }}>
          {props.matchedSymptomCodes.map((code) => (
            <span key={code} className="chip chip-static">
              {shortLabel(code, byCode.get(code) ?? code)}
            </span>
          ))}
        </div>
      </div>
      <div className="result-card">
       <p className="result-message">{props.t(config.bodyKey)}</p>
<p className="disclaimer-card">{props.t("notADiagnosisResult")}</p>
        <span className="spacer" />
        <div className="result-actions">
          {props.tier === "emergency" ? (
            <a className={`primary-button tier-${props.tier}`} style={{ textAlign: "center" }} href={`tel:${EMERGENCY_HOTLINE}`}>
               <Icon name="phone" size={16} />
              {props.t("callForHelp")}
            </a>
          ) : (
            <button type="button" className={`primary-button tier-${props.tier}`} onClick={props.onViewHealthTips}>
              {props.t("viewHealthTips")}
              {props.t("viewHealthTips")}
            </button>
          )}
          <button type="button" className="outline-button" onClick={props.onCheckAgain}>
            <Icon name="refresh" size={16} />
            {props.t("checkAgain")}
          </button>
        </div>
      </div>
    </section>
  );
}
