import type { Translator } from "../i18n";
import { CareMark, OfflineBadge } from "./parts";

/**
 * Figure 21, Home Page — "the persistent landing state for every return visit:
 * no login, no history, and no personal data displayed."
 */
export function HomeScreen(props: {
  t: Translator;
  barangayName: string;
  languageLabel: string;
  needsConnection: boolean;
  onCheck: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="screen">
      <div className="top-row">
        <OfflineBadge t={props.t} />
        <div className="mc-row" style={{ gap: 8 }}>
          <span className="pill">{props.languageLabel}</span>
          <button className="icon-btn icon-btn-round" onClick={props.onSettings} aria-label={props.t("settings")}>
            ⚙
          </button>
        </div>
      </div>

      <p className="subtitle" style={{ marginTop: 26 }}>
        {props.t("hello")}
      </p>
      <h1 className="title title-lg">{props.t("howAreYouFeeling")}</h1>
      <p className="subtitle">📍 {props.t("barangayLine", { barangay: props.barangayName })}</p>

      <div className="grow">
        {props.needsConnection ? (
          <div className="banner banner-warn">
            <strong>{props.t("needConnectionTitle")}</strong>
            <br />
            {props.t("needConnectionBody")}
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
