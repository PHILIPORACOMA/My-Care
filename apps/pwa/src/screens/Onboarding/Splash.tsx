import { Icon } from "../../components/Icon.js";

/** Figure 15: Welcome / splash screen — the app's entry point, no login. */
export function Splash(props: { onGetStarted: () => void; t: (key: string) => string }) {
  return (
    <div className="splash-screen">
      <span className="spacer" />
      <span className="icon-badge">
        <Icon name="heartbeat" size={32} />
      </span>
      <h1>{props.t("appTitle")}</h1>
      <p>Ang imong giya sa panglawas, bisan asa.</p>
      <span className="spacer" />
      <span className="pill chip-static">
        {props.t("worksOffline")} · {props.t("offlineReady")}
      </span>
      <button type="button" className="primary-button" onClick={props.onGetStarted}>
        {props.t("getStarted")}
      </button>
    </div>
  );
}
