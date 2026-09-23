import type { Trends } from "@mycare/api-client";
import { Async, Badge, Banner, Card, Count, DataTable, PageHeader, TierVolumeChart, formatDateTime, useAsync } from "@mycare/ui";
import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { PrivacyNote } from "./filters";

const STATE_TONE = { rising: "warn", stable: "ok", low: "neutral" } as const;

function clusterSentence(cluster: Trends["clusters"][number]): string {
  const where = cluster.tier ? `${cluster.tier} referrals` : "sessions";
  const change = cluster.changePercent === null ? "an unusual rise" : `a ${cluster.changePercent}% week-over-week rise`;
  return `${cluster.displayName}: ${change} in ${where} this week.`;
}

/**
 * Figure 32, Trends & Surveillance — internal situational awareness, never
 * pushed back to patients. The cluster banner flags statistically unusual
 * rises (ADR-0007); it is a prompt to look, not a diagnosis.
 */
export function TrendsPage() {
  const { user } = useAuth();
  const [barangayId] = useState<number | null>(null);
  const state = useAsync(() => api.staff.trends(barangayId), [barangayId]);

  return (
    <>
      <PageHeader
        title="Trends & surveillance"
        subtitle={user?.barangayName ? `Last 14 days in ${user.barangayName}` : "Last 14 days across every barangay"}
      />

      <Async state={state}>
        {(trends) => (
          <div className="mc-stack">
            {trends.clusters.length > 0 ? (
              <Banner tone="warning" title="Possible clusters this week" className="cluster-banner">
                <ul className="mc-list">
                  {trends.clusters.map((cluster) => (
                    <li key={`${cluster.symptomCode}-${cluster.tier ?? "all"}`}>{clusterSentence(cluster)}</li>
                  ))}
                </ul>
                <p className="mc-small mc-flush-bottom">
                  Flagged when this week is at least five sessions, well above the previous four weeks, and unlikely by chance. Worth a look, not a
                  conclusion.
                </p>
              </Banner>
            ) : (
              <Banner tone="success" title="No unusual rises this week">
                Nothing in the last seven days stands out against the previous four weeks.
              </Banner>
            )}

            <Card
              title="Daily volume by outcome"
              aside={<span className="mc-muted mc-small">Aggregates updated {formatDateTime(trends.computedAt)}</span>}
            >
              <TierVolumeChart days={trends.series} highlight={trends.clusters.length > 0 ? trends.currentWeek : undefined} />
              <PrivacyNote>
                Days with fewer than five sessions are shown as a hatched block, not a bar — a bar would give the hidden number away. Shaded days are
                this week, the period a cluster flag covers.
              </PrivacyNote>
            </Card>

            <Card title="Watch list">
              <DataTable
                rows={trends.watchList}
                rowKey={(w) => w.symptomCode}
                empty="No symptom has enough sessions to track yet."
                columns={[
                  { key: "symptom", header: "Symptom", render: (w) => w.displayName },
                  { key: "week", header: "This week", numeric: true, render: (w) => <Count cell={w.currentWeek} /> },
                  {
                    key: "change",
                    header: "Change",
                    numeric: true,
                    render: (w) => (w.changePercent === null ? <span className="mc-muted">—</span> : `${w.changePercent > 0 ? "+" : ""}${w.changePercent}%`),
                  },
                  {
                    key: "state",
                    header: "State",
                    render: (w) => (
                      <span className="watch-state">
                        <Badge tone={STATE_TONE[w.state]}>{w.state}</Badge>
                      </span>
                    ),
                  },
                ]}
              />
              <PrivacyNote>
                A percentage is only shown when both weeks are above the suppression threshold; otherwise it would reveal a hidden count.
              </PrivacyNote>
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
