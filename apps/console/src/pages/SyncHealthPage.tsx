import type { ConsoleDevice } from "@mycare/api-client";
import { Async, Badge, Button, Card, Count, DataTable, PageHeader, StatCard, formatDateTime, formatRelative, useAsync } from "@mycare/ui";
import { useState } from "react";
import { api } from "../api";
import { ServiceDot } from "./SystemDashboardPage";

const DAY = 24 * 60 * 60 * 1000;

function freshness(lastSyncAt: string | null): { tone: "ok" | "warn" | "danger" | "neutral"; label: string } {
  if (!lastSyncAt) return { tone: "neutral", label: "never reported" };
  const age = Date.now() - new Date(lastSyncAt).getTime();
  if (age < DAY) return { tone: "ok", label: formatRelative(lastSyncAt) };
  if (age < 7 * DAY) return { tone: "warn", label: formatRelative(lastSyncAt) };
  return { tone: "danger", label: `offline, ${formatRelative(lastSyncAt)}` };
}

/**
 * Figure 40, Sync & System Health: a system-wide version of the sub-admin sync
 * screen, so the team can tell a backend fault from the normal latency of
 * offline-first devices. Devices can be revoked here (ADR-0005).
 */
export function SyncHealthPage() {
  const state = useAsync(() => Promise.all([api.console.systemHealth(), api.console.devices()]), []);
  const [working, setWorking] = useState<number>();

  async function toggle(device: ConsoleDevice) {
    setWorking(device.id);
    try {
      if (device.approved) await api.console.revokeDevice(device.id);
      else await api.console.reinstateDevice(device.id);
      state.reload();
    } finally {
      setWorking(undefined);
    }
  }

  return (
    <>
      <PageHeader title="Sync & system health" subtitle="Is it the server, or just a barangay out of signal?" />
      <Async state={state}>
        {([health, devices]) => {
          const service = (key: string) => health.services.find((s) => s.key === key);
          return (
            <div className="mc-stack">
              <div className="mc-grid mc-grid-4">
                {["api", "database", "replay", "aggregation"].map((key) => {
                  const s = service(key);
                  return s ? (
                    <StatCard
                      key={key}
                      label={s.label}
                      value={
                        <span className="mc-glyph">
                          <ServiceDot status={s.status} />
                          {s.status}
                        </span>
                      }
                      hint={s.detail}
                    />
                  ) : null;
                })}
                <StatCard
                  label="Sync queue on devices"
                  value={<Count cell={health.metrics.syncQueue.pendingSessions} />}
                  hint={`${health.metrics.syncQueue.devicesNotReporting} devices have not reported a queue`}
                />
              </div>

              <Card title="Barangays">
                <DataTable
                  rows={health.barangays}
                  rowKey={(b) => b.id}
                  columns={[
                    { key: "name", header: "Barangay", render: (b) => b.name },
                    { key: "devices", header: "Devices", numeric: true, render: (b) => b.devices },
                    {
                      key: "last",
                      header: "Last reported",
                      render: (b) => {
                        const f = freshness(b.lastSyncAt);
                        return <Badge tone={f.tone}>{f.label}</Badge>;
                      },
                    },
                  ]}
                />
              </Card>

              <Card title="Enrolled devices" aside={<span className="mc-muted mc-small">Self-registered; revoke to block uploads</span>}>
                <DataTable
                  rows={devices}
                  rowKey={(d) => d.id}
                  empty="No devices have registered yet."
                  columns={[
                    { key: "label", header: "Device", render: (d) => <span className="mc-mono">{d.label}</span> },
                    { key: "type", header: "Type", render: (d) => d.type.replace(/_/g, " ") },
                    { key: "barangay", header: "Barangay", render: (d) => d.barangayName ?? "—" },
                    { key: "registered", header: "Registered", render: (d) => formatDateTime(d.registeredAt) },
                    { key: "sync", header: "Last sync", render: (d) => formatRelative(d.lastSyncAt) },
                    // Yes/no, never the count: a per-device number under 5 would get round
                    // the suppression rule. "yes" beside an empty queue read as a fault.
                    { key: "pending", header: "Holding sessions", render: (d) => (d.pendingSessions === null ? "not reported" : d.pendingSessions > 0 ? "some waiting" : "none") },
                    { key: "state", header: "State", render: (d) => <Badge tone={d.approved ? "ok" : "danger"}>{d.approved ? "approved" : "revoked"}</Badge> },
                    {
                      key: "action",
                      header: <span className="mc-visually-hidden">Action</span>,
                      render: (d) => (
                        <Button size="sm" variant={d.approved ? "ghost" : "secondary"} busy={working === d.id} onClick={() => void toggle(d)}>
                          {d.approved ? "Revoke" : "Reinstate"}
                        </Button>
                      ),
                    },
                  ]}
                />
              </Card>
            </div>
          );
        }}
      </Async>
    </>
  );
}
