import type { Cell, Dashboard } from "@mycare/api-client";
import {
  Async,
  Card,
  Count,
  EmptyState,
  PageHeader,
  RankList,
  Segmented,
  StatCard,
  SyncPill,
  TIER_LABELS,
  formatDateTime,
  manilaToday,
  shiftDays,
  useAsync,
} from "@mycare/ui";
import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { BarangayPicker, PrivacyNote } from "./filters";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

type RangeKey = (typeof RANGES)[number]["value"];

/**
 * Week-over-week change, as Figure 31 shows it ("▲ 12% vs last week").
 *
 * Only stated when both periods are displayable. A percentage against a
 * suppressed figure would let a reader solve for the hidden count, which is
 * the same reason the trends screen withholds its own percentages.
 */
function delta(now: Cell, before: Cell): { text: string; tone: "good" | "warn" | "flat" } | undefined {
  if (now.value === null || before.value === null || before.value === 0) {
    return undefined;
  }
  const change = Math.round(((now.value - before.value) / before.value) * 100);
  if (change === 0) {
    return { text: "No change vs previous period", tone: "flat" };
  }
  return {
    text: `${change > 0 ? "▲" : "▼"} ${Math.abs(change)}% vs previous period`,
    tone: change > 0 ? "warn" : "good",
  };
}

/**
 * Figure 31, Dashboard — the sub-admin's landing view: outcome volumes for
 * their barangay and the most common symptom codes, de-identified and
 * suppressed below five.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const [days, setDays] = useState<RangeKey>("30");
  const [barangayId, setBarangayId] = useState<number | null>(null);

  const state = useAsync(async () => {
    const today = manilaToday();
    const span = Number(days);
    const current = { from: shiftDays(today, -(span - 1)), to: today, barangayId };
    const previous = { from: shiftDays(today, -(span * 2 - 1)), to: shiftDays(today, -span), barangayId };

    // Both periods in parallel; the second is only used for the change line.
    const [now, before] = await Promise.all([api.staff.dashboard(current), api.staff.dashboard(previous)]);
    return { now, before } as { now: Dashboard; before: Dashboard };
  }, [days, barangayId]);

  const where = user?.barangayName ? `Brgy. ${user.barangayName} — Triage overview` : "All barangays — Triage overview";

  return (
    <>
      <PageHeader
        title={where}
        subtitle="Carcar City RHU · de-identified, aggregated"
        actions={
          <>
            <Segmented label="Date range" value={days} options={[...RANGES]} onChange={setDays} />
            <BarangayPicker value={barangayId} onChange={setBarangayId} />
          </>
        }
      />

      <Async state={state}>
        {({ now, before }) => (
          <div className="mc-stack">
            <div className="mc-row" style={{ justifyContent: "space-between" }}>
              <SyncPill>As of last aggregate: {formatDateTime(now.computedAt)}</SyncPill>
              <span className="mc-small mc-muted">
                {now.range.from} to {now.range.to} · <Count cell={now.total} /> sessions
              </span>
            </div>

            <div className="mc-grid mc-grid-3">
              {(["home", "rhu", "emergency"] as const).map((tier) => (
                <StatCard
                  key={tier}
                  label={TIER_LABELS[tier]}
                  value={<Count cell={now.tiers[tier]} />}
                  tone={tier}
                  delta={delta(now.tiers[tier], before.tiers[tier])}
                  hint={now.tiers[tier].suppressed ? "Counts under 5 hidden for privacy" : undefined}
                />
              ))}
            </div>

            <Card title="Top symptom codes" aside={<span className="mc-muted mc-small">Aggregates updated {formatDateTime(now.computedAt)}</span>}>
              {now.topSymptoms.length === 0 ? (
                <EmptyState>
                  Nothing to rank yet. A symptom appears here once it reaches five sessions in the period.
                </EmptyState>
              ) : (
                <RankList
                  items={now.topSymptoms.map((s) => ({
                    key: s.code,
                    name: (
                      <>
                        {s.displayName} <span className="mc-mono mc-muted">{s.code}</span>
                      </>
                    ),
                    value: s.count.value ?? 0,
                    display: s.count.display,
                  }))}
                />
              )}
              <PrivacyNote>
                Symptoms with fewer than five sessions are left out of this ranking entirely — ordering them would reveal their relative sizes.
              </PrivacyNote>
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
