/**
 * The My Care mark, from the team's design canvas: a circle with a pulse
 * trace. Used at three sizes — sidebar (30px), login (58px) and the patient
 * splash (86px) — so it lives here rather than being redrawn per app.
 */
export function CareMark({ size = 30, stroke = "#fff" }: { size?: number; stroke?: string }) {
  return (
    <svg
      width={size * 0.56}
      height={size * 0.56}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 12.5h2.2l1.4-3 1.8 5 1.3-2h2.3" />
    </svg>
  );
}

/**
 * The stacked brand block both login screens share (Figures 30 and 36): mark,
 * wordmark, then the surface name in spaced caps.
 */
export function LoginBrand({ surface }: { surface: string }) {
  return (
    <>
      <div className="mc-login-mark" aria-hidden="true">
        <CareMark size={54} />
      </div>
      <div className="mc-login-word">My Care</div>
      <div className="mc-login-surface">{surface}</div>
    </>
  );
}
