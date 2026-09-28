import type { LanguageCode } from "@mycare/ruleset";
import { useEffect, useRef, useState } from "react";
import { LANGUAGES, type Translator } from "../i18n";
import { Icon } from "./Icon";

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
      <Icon name={connected ? "check" : "circle"} size={14} />
      {t("worksOffline")}
    </span>
  );
}

/**
 * The language pill, on every screen after onboarding (ported as an idea from
 * kizaru3214's feat/pwa-ui-polish). Tapping it opens the three languages in
 * place, so a patient who picked the wrong one, or hands the phone to someone
 * who reads another, can switch without leaving the screen.
 *
 * Switching changes only the interface copy and the language the session is
 * recorded in. Nothing typed or tapped is lost, and the tier cannot change:
 * free text is matched against every language's terms at once, and a
 * clarification answer is sent by position, never by its label (ADR-0006).
 */
export function LanguagePill({ t, language, onChange }: { t: Translator; language: LanguageCode; onChange: (language: LanguageCode) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]!;

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="lang" ref={root}>
      <button
        type="button"
        className="pill"
        aria-expanded={open}
        aria-label={`${t("language")}: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="globe" size={14} />
        {current.label}
      </button>
      {open && (
        <div className="lang-menu" role="group" aria-label={t("language")}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              aria-pressed={l.code === language}
              onClick={() => {
                onChange(l.code);
                setOpen(false);
              }}
            >
              {l.native}
              {l.code === language && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
