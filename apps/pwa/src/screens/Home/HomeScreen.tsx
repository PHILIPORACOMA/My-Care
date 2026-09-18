import type { LanguageCode } from "@mycare/ruleset";
import { StatusPill } from "../../components/StatusPill.js";
import { Icon } from "../../components/Icon.js";

/** Figure 19: persistent landing screen for every return visit — no login, no history shown. */
export function HomeScreen(props: {
  language: LanguageCode;
  barangayCode: string;
  onCheckSymptoms: () => void;
  onOpenSettings: () => void;
  onLanguageClick: () => void;
  t: (key: string) => string;
}) {
  return (
    <section className="screen">
      <div className="home-header">
        <StatusPill label={props.t("worksOffline")} />
        <div className="home-header-actions">
          <button type="button" className="pill" onClick={props.onLanguageClick}>
            <Icon name="globe" size={14} />
            {props.language.toUpperCase()}
          </button>
          <button type="button" className="icon-button" onClick={props.onOpenSettings} aria-label="Settings">
            <Icon name="gear" size={16} />
          </button>
        </div>
      </div>

      <div>
        <p className="home-greeting">{props.t("homeGreeting")} 👋</p>
        <p className="home-question">{props.t("homeQuestion")}</p>
        <p className="home-location">
          <Icon name="mapPin" size={14} />
          Brgy. {props.barangayCode}, Carcar City
        </p>
      </div>

      <div className="check-symptoms-card">
        <span className="icon-badge">
          <Icon name="mic" size={26} />
        </span>
        <h3>{props.t("checkSymptoms")}</h3>
        <p>{props.t("checkSymptomsSubtitle")}</p>
        <button type="button" className="primary-button" onClick={props.onCheckSymptoms}>
          {props.t("getStarted")}
        </button>
      </div>

      <span className="spacer" />
      <p className="disclaimer">{props.t("notADiagnosisLong")}</p>
    </section>
  );
}
