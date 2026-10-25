import { useState } from "react";
import type { Translator } from "../i18n";

/**
 * Shown when the app cannot read its own storage on the phone, instead of a
 * spinner that never ends. Try again first; starting over deletes the
 * database, so it asks before doing it, like Settings does (Figure 29).
 * `blocked`: another tab still holds the database, so the delete is waiting.
 */
export function StorageErrorScreen(props: {
  t: Translator;
  blocked?: boolean;
  onRetry: () => void;
  onStartOver: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="screen">
      <div className="grow stack">
        <div className="banner banner-warn" role="alert">
          <strong>{props.t("storageErrorTitle")}</strong>
          <br />
          {props.t("storageErrorBody")}
        </div>
      </div>
      <div className="push stack">
        {props.blocked ? (
          <p className="banner banner-warn" role="status">
            {props.t("storageBlocked")}
          </p>
        ) : confirming ? (
          <>
            <p className="banner banner-warn">{props.t("startOverConfirm")}</p>
            <button className="btn btn-danger" onClick={props.onStartOver}>
              {props.t("startOver")}
            </button>
            <button className="btn btn-outline" onClick={() => setConfirming(false)}>
              {props.t("cancel")}
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={props.onRetry}>
              {props.t("tryAgain")}
            </button>
            <button className="btn btn-outline" onClick={() => setConfirming(true)}>
              {props.t("startOver")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
