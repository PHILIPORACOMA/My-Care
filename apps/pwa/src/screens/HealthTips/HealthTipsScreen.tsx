import type { LanguageCode, Tier } from "@mycare/ruleset";
import { ScreenHeader } from "../../components/ScreenHeader.js";
import { Icon, type IconName } from "../../components/Icon.js";

const TIER_STATUS_LABEL: Record<Tier, string> = {
  home: "Home management",
  rhu: "RHU referral",
  emergency: "Emergency referral",
};

/**
 * Only RHU has clinician-sourced tip copy (the manuscript's Health Tips
 * figure). Home/Emergency show a placeholder until equivalent content is
 * authored — inventing specific medical instructions here would bypass the
 * project's Clinical Plausibility and Content Validity Appraisal process
 * (docs/REPO.md).
 */
const RHU_TIPS: { icon: IconName; key: string }[] = [
  { icon: "calendarClock", key: "tipRhu1" },
  { icon: "droplet", key: "tipRhu2" },
  { icon: "thermometer", key: "tipRhu3" },
  { icon: "pillOff", key: "tipRhu4" },
];

export function HealthTipsScreen(props: {
  language: LanguageCode;
  tier: Tier;
  onBack: () => void;
  onLanguageClick: () => void;
  t: (key: string) => string;
}) {
  return (
    <section className="screen">
      <ScreenHeader onBack={props.onBack} language={props.language} onLanguageClick={props.onLanguageClick} />
      <span className={`pill pill-status`}>
        <span className="dot" aria-hidden="true" />
        {TIER_STATUS_LABEL[props.tier]}
      </span>
      <h1 className="field-label">{props.t("healthTipsTitle")}</h1>

      {props.tier === "rhu" ? (
        <div className="tips-list">
          {RHU_TIPS.map(({ icon, key }) => (
            <div className="tip-card" key={key}>
              <span className="icon-badge icon-badge-tint">
                <Icon name={icon} size={16} />
              </span>
              <p>{props.t(key)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="disclaimer-card">{props.t("healthTipsComingSoon")}</p>
      )}

      <span className="spacer" />
      <p className="pill chip-static" style={{ justifyContent: "center" }}>
        <Icon name="upload" size={14} />
        {props.t("showToHealthWorker")}
      </p>
    </section>
  );
}
