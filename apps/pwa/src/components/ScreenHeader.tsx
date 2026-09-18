import type { LanguageCode } from "@mycare/ruleset";
import { Icon } from "./Icon.js";

const LANGUAGE_SHORT: Record<LanguageCode, string> = { en: "EN", tl: "TL", ceb: "CEB" };

export function ScreenHeader(props: {
  onBack?: () => void;
  title?: string;
  language?: LanguageCode;
  onLanguageClick?: () => void;
}) {
  return (
    <header className="screen-header">
      {props.onBack ? (
        <button type="button" className="icon-button" onClick={props.onBack} aria-label="Back">
          <Icon name="chevronLeft" size={18} />
        </button>
      ) : (
        <span />
      )}
      {props.title ? <h2>{props.title}</h2> : <span className="spacer" />}
      {props.language ? (
        <button type="button" className="pill" onClick={props.onLanguageClick}>
          <Icon name="globe" size={14} />
          {LANGUAGE_SHORT[props.language]}
        </button>
      ) : null}
    </header>
  );
}
