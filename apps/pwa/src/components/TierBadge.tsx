import type { Tier } from "@mycare/ruleset";

const TIER_DISPLAY: Record<Tier, { emoji: string; className: string }> = {
  home: { emoji: "🟢", className: "tier-badge tier-home" },
  rhu: { emoji: "🟡", className: "tier-badge tier-rhu" },
  emergency: { emoji: "🔴", className: "tier-badge tier-emergency" },
};

export function TierBadge(props: { tier: Tier; label: string }) {
  const { emoji, className } = TIER_DISPLAY[props.tier];
  return (
    <div className={className}>
      <span aria-hidden="true">{emoji}</span> {props.label}
    </div>
  );
}
