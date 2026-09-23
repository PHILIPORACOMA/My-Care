import type { HealthTip, Tier } from "@mycare/ruleset";
import type { TriageResult } from "@mycare/triage-engine";
import type { CopyKey, Translator } from "../i18n";
import type { Facility } from "../storage";
import { OfflineBadge } from "./parts";

const VERDICT: Record<Tier, CopyKey> = {
  home: "resultHome",
  rhu: "resultRhu",
  emergency: "resultEmergency",
};

const ADVICE: Record<Tier, CopyKey> = {
  home: "adviceHome",
  rhu: "adviceRhu",
  emergency: "adviceEmergency",
};

const MARK: Record<Tier, string> = { home: "🏠", rhu: "🏥", emergency: "🚨" };

/**
 * The national emergency number, used only when no facility has been loaded.
 * Facility numbers come from the City Health Office's own list
 * (`mycare:facilities:import`); 911 is the documented fallback so the button
 * is never dead.
 */
const NATIONAL_EMERGENCY = "911";

function emergencyNumber(facilities: Facility[], barangayId: number): string {
  const withNumber = facilities.filter((f) => f.contactNumber);
  const local = withNumber.filter((f) => f.barangayId === barangayId);
  const pick =
    local.find((f) => f.type === "emergency_hotline") ??
    withNumber.find((f) => f.type === "emergency_hotline") ??
    local.find((f) => f.type === "rhu") ??
    withNumber.find((f) => f.type === "rhu") ??
    local[0] ??
    withNumber[0];

  return pick?.contactNumber ?? NATIONAL_EMERGENCY;
}

/**
 * Figures 25–27, the three result screens.
 *
 * One component, three tiers: the same structure in green, amber or red, as
 * the storyboards show. The amber and red screens double as a referral slip —
 * "show this screen to a health worker" — which is why the matched symptoms
 * appear at the top, where a health worker can read them at a glance.
 */
export function ResultScreen(props: {
  t: Translator;
  result: TriageResult;
  chips: string[];
  facilities: Facility[];
  barangayId: number;
  onTips: () => void;
  onAgain: () => void;
}) {
  const tier = props.result.tier;
  const number = emergencyNumber(props.facilities, props.barangayId);

  return (
    <div className={`result result-${tier}`}>
      <div className="result-head">
        <div className="self-end">
          <OfflineBadge t={props.t} />
        </div>
        <div className="result-mark" aria-hidden="true">
          {MARK[tier]}
        </div>
        <h1 className="result-verdict">{props.t(VERDICT[tier])}</h1>
        {props.chips.length > 0 && (
          <>
            <span className="sr-only">{props.t("basedOn")}</span>
            <div className="result-chips">
              {props.chips.map((chip) => (
                <span className="result-chip" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="result-sheet">
        <p className="result-advice">{props.t(ADVICE[tier])}</p>

        {tier !== "home" && <p className="referral">{props.t("showToHealthWorker")}</p>}

        <p className="disclaimer disclaimer-flush">
          {props.t("longDisclaimer")}
        </p>

        <div className="push stack">
          {tier === "emergency" && (
            <a className="btn btn-danger btn-link" href={`tel:${number}`}>
              📞 {props.t("callForHelp")} · {number}
            </a>
          )}
          <button className="btn" onClick={props.onTips}>
            {props.t("viewHealthTips")}
          </button>
          <button className="btn btn-outline" onClick={props.onAgain}>
            {props.t("checkAgain")}
          </button>
          {props.result.matchedRuleCode && (
            <p className="result-rule center">
              {props.result.matchedRuleCode}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Figure 28, Health Tips — tier-specific guidance as scannable cards. */
export function TipsScreen(props: { t: Translator; tips: HealthTip[]; tier: Tier; onBack: () => void }) {
  return (
    <div className="screen">
      <div className="top-row">
        <button className="icon-btn icon-btn-round" onClick={props.onBack} aria-label={props.t("back")}>
          ←
        </button>
        <OfflineBadge t={props.t} />
      </div>

      <h1 className="title">
        {props.t("healthTips")}
      </h1>

      <div className="list">
        {props.tips.length === 0 && <p className="banner">{props.t("noTips")}</p>}
        {props.tips.map((tip, index) => (
          <div className="tip" key={`${tip.title}-${index}`}>
            <span className="tip-mark" aria-hidden="true">
              💡
            </span>
            <div className="tip-body">
              <strong>{tip.title}</strong>
              {tip.body}
            </div>
          </div>
        ))}
      </div>

      {props.tier !== "home" && <p className="referral">{props.t("showToHealthWorker")}</p>}
      <p className="disclaimer">{props.t("longDisclaimer")}</p>
    </div>
  );
}
