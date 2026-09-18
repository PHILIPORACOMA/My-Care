import { Async, Card, Count, EmptyState, PageHeader, StatCard, TIER_LABELS, formatDateTime, useAsync } from "@mycare/ui";
import { api } from "../api";
import { useAuth } from "../auth";
import { PrivacyNote, RangeFilters, useRangeFilters } from "./filters";

/**
 * Figure 31, Dashboard — the sub-admin's landing view: outcome volumes for
 * their barangay and the most common symptom codes, all de-identified and
 * suppressed below five.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const { range, setRange, today } = useRangeFilters(30);
  const state = useAsync(() => api.staff.dashboard(range), [range.from, range.to, range.barangayId]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={user?.barangayName ? `Triage activity in ${user.barangayName}` : "Triage activity across every barangay"}
        actions={<RangeFilters range={range} onChange={setRange} today={today} />}
      />

      <Async state={state}>
        {(data) => (
          <div className="mc-stack">
            <div className="mc-grid mc-grid-4">
              <StatCard label="Sessions" value={<Count cell={data.total} />} hint={`${data.range.from} to ${data.range.to}`} tone="accent" />
              {(["home", "rhu", "emergency"] as const).map((tier) => (
                <StatCard key={tier} label={TIER_LABELS[tier]} value={<Count cell={data.tiers[tier]} />} tone={tier} />
              ))}
            </div>

            <Card
              title="Most common symptoms"
              aside={<span className="mc-muted mc-small">Aggregates updated {formatDateTime(data.computedAt)}</span>}
            >
              {data.topSymptoms.length === 0 ? (
                <EmptyState>
                  Nothing to rank yet. Symptoms with fewer than five sessions are never listed, so this stays empty until a symptom reaches five.
                </EmptyState>
              ) : (
                <ol className="rank-list">
                  {data.topSymptoms.map((symptom) => {
                    const top = data.topSymptoms[0]?.count.value ?? 1;
                    const share = Math.round(((symptom.count.value ?? 0) / top) * 100);
                    return (
                      <li key={symptom.code}>
                        <span>
                          {symptom.displayName} <span className="mc-mono mc-small mc-muted">{symptom.code}</span>
                        </span>
                        <strong>
                          <Count cell={symptom.count} />
                        </strong>
                        <span className="rank-bar" aria-hidden="true">
                          <span style={{ width: `${share}%` }} />
                        </span>
                      </li>
                    );
                  })}
                </ol>
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
