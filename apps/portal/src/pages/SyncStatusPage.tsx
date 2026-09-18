import { Async, Badge, Banner, Card, Count, DataTable, PageHeader, StatCard, formatDateTime, formatRelative, useAsync } from "@mycare/ui";
import { api } from "../api";
import { PrivacyNote } from "./filters";

/**
 * Figure 33, Sync & System Status (UT-014).
 *
 * The point of this screen is to make the offline-first design legible: a stale
 * figure means a barangay is out of signal, not that the system is broken.
 */
export function SyncStatusPage() {
  const state = useAsync(() => api.staff.syncStatus(), []);

  return (
    <>
      <PageHeader title="Sync & status" subtitle="Where the numbers on the other screens came from, and how current they are." />

      <Async state={state}>
        {(sync) => (
          <div className="mc-stack">
            {sync.isCurrent ? (
              <Banner tone="success" title="Data is current">
                A device last reported {formatRelative(sync.lastSyncAt)} ({formatDateTime(sync.lastSyncAt)}).
              </Banner>
            ) : (
              <Banner tone="warning" title="Data may be behind">
                {sync.lastSyncAt
                  ? `No device has reported since ${formatDateTime(sync.lastSyncAt)}. Patients' phones keep triaging offline; their sessions arrive when a device next reaches signal.`
                  : "No device has reported yet. Patients' phones can still triage offline."}
              </Banner>
            )}

            <div className="mc-grid mc-grid-4">
              <StatCard label="Devices reporting" value={`${sync.devices.reportedLast7d} / ${sync.devices.total}`} hint="In the last 7 days" tone="accent" />
              <StatCard label="Reported today" value={sync.devices.reportedLast24h} hint="In the last 24 hours" />
              <StatCard label="Sessions waiting on devices" value={<Count cell={sync.pendingUploads.sessions} />} hint={`${sync.pendingUploads.devicesNotReporting} devices have not reported a queue`} />
              <StatCard label="Sessions received" value={<Count cell={sync.sessions.last7Days} />} hint={`Last 7 days · ${sync.sessions.total.display} in total`} />
            </div>

            <Card title="Device coverage">
              <DataTable
                rows={sync.barangays}
                rowKey={(b) => b.id}
                empty="No barangays in scope."
                columns={[
                  { key: "name", header: "Barangay", render: (b) => b.name },
                  { key: "devices", header: "Devices", numeric: true, render: (b) => b.devices },
                  { key: "reporting", header: "Reported in 7 days", numeric: true, render: (b) => b.reportedLast7d },
                  {
                    key: "last",
                    header: "Last report",
                    render: (b) => (
                      <Badge tone={b.lastSyncAt ? "ok" : "neutral"}>{b.lastSyncAt ? formatRelative(b.lastSyncAt) : "never"}</Badge>
                    ),
                  },
                ]}
              />
              <PrivacyNote>
                Device counts are equipment, not patients, so they are shown exactly. Session counts follow the same suppression rule as every other
                figure.
              </PrivacyNote>
            </Card>

            <p className="mc-small mc-muted">
              Last completed upload batch: {formatDateTime(sync.lastBatchAt)}. A device reports how many sessions it is still holding; "not reported"
              means it has not been in signal recently enough to say.
            </p>
          </div>
        )}
      </Async>
    </>
  );
}
