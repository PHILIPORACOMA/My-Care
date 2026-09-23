import type { Translator } from "../i18n";
import type { BundleBlocker } from "../sync";
import { CareMark, OfflineBadge } from "./parts";

/*
 * Three reasons a device can have no rules, and they are not interchangeable:
 * the patient can fix the first by finding signal, and cannot fix the other
 * two at all. Telling them apart is the difference between a useful screen
 * and one that sends someone up a hill for nothing.
 */
const BLOCKER_TITLE: Record<BundleBlocker, "needConnectionTitle" | "noRulesTitle" | "serverProblemTitle"> = {
  offline: "needConnectionTitle",
  unpublished: "noRulesTitle",
  server: "serverProblemTitle",
};

const BLOCKER_BODY: Record<BundleBlocker, "needConnectionBody" | "noRulesBody" | "serverProblemBody"> = {
  offline: "needConnectionBody",
  unpublished: "noRulesBody",
  server: "serverProblemBody",
};

/**
 * Figure 21, Home Page — "the persistent landing state for every return visit:
 * no login, no history, and no personal data displayed."
 */
export function HomeScreen(props: {
  t: Translator;
  barangayName: string;
  languageLabel: string;
  blocker?: BundleBlocker;
  onCheck: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="screen">
      <div className="top-row">
        <OfflineBadge t={props.t} />
        <div className="row-inline">
          <span className="pill">{props.languageLabel}</span>
          <button className="icon-btn icon-btn-round" onClick={props.onSettings} aria-label={props.t("settings")}>
            ⚙
          </button>
        </div>
      </div>

      <p className="subtitle subtitle-top">
        {props.t("hello")}
      </p>
      <h1 className="title title-lg">{props.t("howAreYouFeeling")}</h1>
      <p className="subtitle">📍 {props.t("barangayLine", { barangay: props.barangayName })}</p>

      <div className="grow">
        {props.blocker ? (
          <div className="banner banner-warn">
            <strong>{props.t(BLOCKER_TITLE[props.blocker])}</strong>
            <br />
            {props.t(BLOCKER_BODY[props.blocker])}
          </div>
        ) : (
          <button className="home-card" onClick={props.onCheck}>
            <span className="home-card-mark">
              <CareMark size={30} />
            </span>
            <span className="home-card-title">{props.t("checkSymptoms")}</span>
            <span className="home-card-sub">{props.t("describeHowYouFeel")}</span>
            <span className="home-card-cta">{props.t("getStarted")}</span>
          </button>
        )}
      </div>

      <p className="disclaimer">{props.t("notADiagnosisShort")}</p>
    </div>
  );
}
