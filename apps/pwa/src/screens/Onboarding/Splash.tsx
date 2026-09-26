import { Icon } from "../../components/Icon.js";

function LogoMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.6" />
      <path
        d="M6.5 12h2.2l1.4-3.4L13 16l1.6-4h2.9"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Figure 15: Welcome / splash screen — the app's entry point, no login. */
export function Splash(props: { onGetStarted: () => void; t: (key: string) => string }) {
  return (
    <div className="splash-screen">
      <span className="spacer" />
      <span className="splash-logo-badge">
        <LogoMark />
      </span>
      <h1>{props.t("appTitle")}</h1>
      <p>Ang iyong gabay sa kalusugan, kahit saan.</p>
      <span className="spacer" />
      <span className="pill chip-static">
        <Icon name="tag" size={14} />
        {props.t("worksOffline")} · {props.t("offlineReady")}
      </span>
      <button type="button" className="primary-button splash-cta" onClick={props.onGetStarted}>
        {props.t("getStarted")}
      </button>
    </div>
  );
}
