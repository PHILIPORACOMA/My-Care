import { Async, Badge, Card, Count, DataTable, PageHeader, StatCard, formatDateTime, formatRelative, useAsync } from "@mycare/ui";
import type { ServiceStatus } from "@mycare/api-client";
import { api } from "../api";

export function ServiceDot({ status }: { status: ServiceStatus }) {
  return <span className={`status-dot status-${status}`} aria-hidden="true" />;
}

const STATUS_TONE = { ok: "ok", degraded: "warn", down: "danger" } as const;

/** Figure 37, System Dashboard. */
export function SystemDashboardPage() {
  const state = useAsync(() => api.console.systemHealth(), []);

  return (
    <>
      <PageHeader title="System dashboard" subtitle="Operational overview across every barangay." />
      <Async state={state}>
        {(health) => {
          const syncHealth =
            health.metrics.devicesApproved === 0
              ? "—"
              : `${Math.round((health.metrics.devicesReportedLast7d / health.metrics.devicesApproved) * 100)}%`;

          return (
            <div className="mc-stack">
              <div className="mc-grid mc-grid-4">
                <StatCard
                  label="Barangays live"
                  value={`${health.metrics.barangaysLive} / ${health.metrics.barangaysTotal}`}
                  hint="A device synced in the last 7 days"
                  tone="accent"
                />
                <StatCard label="Sync health" value={syncHealth} hint={`${health.metrics.devicesReportedLast7d} of ${health.metrics.devicesApproved} devices reported in 7 days`} />
                <StatCard label="Active sub-admin accounts" value={health.metrics.activeSubAdmins} />
                <StatCard
                  label="Published ruleset"
                  value={health.publishedVersion?.label ?? "None"}
                  hint={health.publishedVersion ? `Since ${formatDateTime(health.publishedVersion.publishedAt)}` : "Devices cannot triage until one is published"}
                />
              </div>

              <div className="mc-grid mc-grid-2">
                <Card title="Service health" aside={<span className="mc-muted mc-small">Checked {formatRelative(health.checkedAt)}</span>}>
                  <DataTable
                    rows={health.services}
                    rowKey={(s) => s.key}
                    columns={[
                      {
                        key: "service",
                        header: "Service",
                        render: (s) => (
                          <>
                            <ServiceDot status={s.status} />
                            {s.label}
                          </>
                        ),
                      },
                      { key: "status", header: "Status", render: (s) => <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge> },
                      { key: "detail", header: "Detail", render: (s) => <span className="mc-small">{s.detail}</span> },
                    ]}
                  />
                </Card>

                <Card title="Activity">
                  <dl className="mc-grid" style={{ gridTemplateColumns: "1fr auto", margin: 0, rowGap: 8 }}>
                    <dt className="mc-muted">Sessions synced, last 24 hours</dt>
                    <dd style={{ margin: 0 }}>
                      <Count cell={health.metrics.sessionsLast24h} />
                    </dd>
                    <dt className="mc-muted">Upload batches, last 24 hours</dt>
                    <dd style={{ margin: 0 }}>{health.metrics.batchesLast24h}</dd>
                    <dt className="mc-muted">Sessions waiting on devices</dt>
                    <dd style={{ margin: 0 }}>
                      <Count cell={health.metrics.syncQueue.pendingSessions} />
                    </dd>
                    <dt className="mc-muted">Emergency contacts configured</dt>
                    <dd style={{ margin: 0 }}>{health.metrics.activeFacilities}</dd>
                    <dt className="mc-muted">Aggregates last rebuilt</dt>
                    <dd style={{ margin: 0 }}>{health.lastAggregation ? formatRelative(health.lastAggregation.finishedAt) : "never"}</dd>
                    <dt className="mc-muted">Build</dt>
                    <dd style={{ margin: 0 }} className="mc-mono">
                      {health.appVersion}
                    </dd>
                  </dl>
                  {health.metrics.activeFacilities === 0 && (
                    <p className="mc-small mc-muted" style={{ marginBottom: 0 }}>
                      No facilities are loaded, so "Call for help" falls back to 911. Import the City Health Office's list with{" "}
                      <code>php artisan mycare:facilities:import</code>.
                    </p>
                  )}
                </Card>
              </div>
            </div>
          );
        }}
      </Async>
    </>
  );
}
