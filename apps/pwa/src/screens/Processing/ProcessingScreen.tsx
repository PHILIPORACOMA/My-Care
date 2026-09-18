import { Icon } from "../../components/Icon.js";

/** Figure "On-device Processing": purely presentational — no network call, engine runs synchronously underneath. */
export function ProcessingScreen(props: { t: (key: string) => string }) {
  return (
    <section className="screen processing-screen">
      <span className="pulse-ring">
        <span className="pulse-ring-inner">
          <Icon name="heartbeat" size={24} />
        </span>
      </span>
      <p className="field-label">{props.t("analyzing")}</p>
      <span className="pill">{props.t("onDeviceAnalysis")}</span>
    </section>
  );
}
