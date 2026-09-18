import type { Translator } from "../i18n";

/** The My Care mark from the design canvas. */
export function CareMark({ size = 32, stroke = "#fff" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M7 12.5h2.4l1.5-3.4 2 5.6 1.4-2.2H17" />
    </svg>
  );
}

/** The three-step progress bar on the onboarding screens (Figures 18–20). */
export function Steps({ step, t }: { step: 1 | 2 | 3; t: Translator }) {
  return (
    <>
      <div className="steps" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <i key={n} className={n <= step ? "on" : undefined} />
        ))}
      </div>
      <div className="step-label">{t("stepOf", { n: step })}</div>
    </>
  );
}

/**
 * The "Works offline" badge that stays visible throughout (Figures 17–29).
 * It reflects the real connection, because telling a patient they are offline
 * when they are not — or the reverse — is worse than not saying.
 */
export function OfflineBadge({ t, online }: { t: Translator; online?: boolean }) {
  const connected = online ?? (typeof navigator === "undefined" ? true : navigator.onLine);

  return (
    <span className="pill">
      <span aria-hidden="true">{connected ? "✓" : "◌"}</span>
      {t("worksOffline")}
    </span>
  );
}
