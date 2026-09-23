import type { Cell, TierCells } from "@mycare/api-client";
import { MASK_EXPLANATION, TIER_LABELS } from "./components.js";

const TIER_COLOURS = {
  home: "var(--tier-home)",
  rhu: "var(--tier-rhu)",
  emergency: "var(--tier-emergency)",
} as const;

const TIERS = ["home", "rhu", "emergency"] as const;

export interface DailyTiers {
  date: string;
  total: Cell;
  tiers: TierCells;
}

/**
 * The 14-day volume chart on Trends & Surveillance (Figure 32).
 *
 * Plain SVG, no chart library. A day whose total is suppressed is drawn as a
 * hatched placeholder of fixed height — never a bar sized to a hidden count.
 * When the total is shown but a tier is masked, the masked tiers are drawn as
 * one hatched segment whose height is the total minus the shown tiers, which
 * reveals only their sum (complementary suppression guarantees at least two).
 * Days inside `highlight` are shaded, as the figure shades the days that
 * contribute to a flagged cluster.
 */
export function TierVolumeChart(props: { days: DailyTiers[]; highlight?: { from: string; to: string } }) {
  const width = 640;
  const height = 220;
  const pad = { top: 12, right: 8, bottom: 28, left: 32 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(5, ...props.days.map((d) => d.total.value ?? 0));
  const slot = innerW / Math.max(props.days.length, 1);
  const barW = Math.max(6, slot * 0.62);
  const y = (value: number) => (value / max) * innerH;

  return (
    <figure className="mc-flush">
      <svg className="mc-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily triage sessions by tier">
        <defs>
          <pattern id="mc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--surface-muted)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" strokeWidth="3" />
          </pattern>
        </defs>

        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH - f * innerH} y2={pad.top + innerH - f * innerH} stroke="var(--border)" />
            <text className="mc-chart-axis" x={pad.left - 6} y={pad.top + innerH - f * innerH + 3} textAnchor="end">
              {Math.round(max * f)}
            </text>
          </g>
        ))}

        {props.days.map((day, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const inHighlight = props.highlight && day.date >= props.highlight.from && day.date <= props.highlight.to;
          const label = day.date.slice(8);

          let segments: JSX.Element[] = [];
          if (day.total.value === null) {
            segments = [
              <rect key="masked" x={x} y={pad.top + innerH - 18} width={barW} height={18} fill="url(#mc-hatch)" rx={2}>
                <title>{`${day.date}: ${MASK_EXPLANATION}`}</title>
              </rect>,
            ];
          } else {
            let offset = 0;
            let shown = 0;
            for (const tier of TIERS) {
              const value = day.tiers[tier].value;
              if (value === null || value === 0) continue;
              shown += value;
              const h = y(value);
              segments.push(
                <rect key={tier} x={x} y={pad.top + innerH - offset - h} width={barW} height={h} fill={TIER_COLOURS[tier]}>
                  <title>{`${day.date} — ${TIER_LABELS[tier]}: ${value}`}</title>
                </rect>
              );
              offset += h;
            }
            const hidden = day.total.value - shown;
            if (hidden > 0) {
              const h = y(hidden);
              segments.push(
                <rect key="hidden" x={x} y={pad.top + innerH - offset - h} width={barW} height={h} fill="url(#mc-hatch)">
                  <title>{`${day.date}: some tiers had fewer than 5 sessions and are hidden`}</title>
                </rect>
              );
            }
          }

          return (
            <g key={day.date}>
              {inHighlight && (
                <rect x={pad.left + i * slot} y={pad.top} width={slot} height={innerH} fill="var(--tier-rhu-soft)" opacity={0.7} />
              )}
              {segments}
              <text className="mc-chart-axis" x={x + barW / 2} y={height - 10} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mc-legend mc-mt-2">
        {TIERS.map((tier) => (
          <span key={tier} style={{ ["--swatch" as string]: TIER_COLOURS[tier] }}>
            {TIER_LABELS[tier]}
          </span>
        ))}
        <span style={{ ["--swatch" as string]: "var(--border)" }}>Hidden (fewer than 5)</span>
      </figcaption>
    </figure>
  );
}
