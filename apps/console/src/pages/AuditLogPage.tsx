import type { AuditCategory, AuditEntry } from "@mycare/api-client";
import {
  Async,
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  Dialog,
  PageHeader,
  SelectField,
  TextField,
  formatDateTime,
  manilaToday,
  saveBlob,
  shiftDays,
  useAsync,
} from "@mycare/ui";
import { useState } from "react";
import { api } from "../api";

const CATEGORIES: { value: AuditCategory | ""; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "rules", label: "Rules & lexicon" },
  { value: "accounts", label: "Accounts" },
  { value: "sign-in", label: "Sign-in" },
  { value: "exports", label: "Data exports" },
  { value: "devices", label: "Devices" },
  { value: "reference", label: "Reference data" },
];

const CATEGORY_TONE: Record<string, "info" | "warn" | "ok" | "neutral" | "danger"> = {
  rules: "info",
  accounts: "warn",
  "sign-in": "neutral",
  exports: "ok",
  devices: "neutral",
};

function describe(entry: AuditEntry): string {
  const target = entry.targetId === null ? entry.targetTable : `${entry.targetTable} #${entry.targetId}`;
  return `${entry.actionType.replace(/_/g, " ")} · ${target}`;
}

/**
 * Figure 41, Audit Log. Every privileged action with its actor and time. There
 * is no way to edit or delete an entry, here or in the API. Export is
 * de-identified (staff emails replaced by role and account number).
 */
export function AuditLogPage() {
  const [category, setCategory] = useState<AuditCategory | "">("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const state = useAsync(() => api.console.auditLog({ category, page }), [category, page]);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every privileged action, stamped with the responsible actor and time (Asia/Manila)."
        actions={
          <>
            <SelectField
              label="Category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as AuditCategory | "");
                setPage(1);
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SelectField>
            <Button variant="secondary" onClick={() => setExporting(true)}>
              Export
            </Button>
          </>
        }
      />

      <Async state={state}>
        {(result) => (
          <Card aside={<span className="mc-muted mc-small">{result.total} entries</span>}>
            <DataTable
              rows={result.entries}
              rowKey={(e) => e.id}
              empty="No entries match."
              columns={[
                { key: "time", header: "When", render: (e) => <span className="mc-small">{formatDateTime(e.createdAt)}</span> },
                { key: "actor", header: "Actor", render: (e) => e.actorLabel },
                { key: "category", header: "Category", render: (e) => <Badge tone={CATEGORY_TONE[e.category] ?? "neutral"}>{e.category}</Badge> },
                { key: "action", header: "Action", render: describe },
                {
                  key: "before",
                  header: "State before",
                  render: (e) =>
                    e.oldValue ? (
                      <details>
                        <summary className="mc-small">view</summary>
                        <pre className="json">{JSON.stringify(e.oldValue, null, 2)}</pre>
                      </details>
                    ) : (
                      <span className="mc-muted">—</span>
                    ),
                },
              ]}
            />
            <div className="mc-row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
              <Button size="sm" variant="secondary" disabled={result.page <= 1} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <span className="mc-small mc-muted">
                Page {result.page} of {result.lastPage}
              </span>
              <Button size="sm" variant="secondary" disabled={result.page >= result.lastPage} onClick={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </div>
          </Card>
        )}
      </Async>

      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
    </>
  );
}

function ExportDialog({ onClose }: { onClose: () => void }) {
  const today = manilaToday();
  const [from, setFrom] = useState(shiftDays(today, -30));
  const [to, setTo] = useState(today);
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run() {
    setBusy(true);
    setError(undefined);
    try {
      const report = await api.staff.generateReport({ type: "audit_log", format, from, to });
      const file = await api.staff.downloadReport(report.id);
      saveBlob(file.blob, file.filename);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title="Export the audit log"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy} onClick={() => void run()}>
            Export
          </Button>
        </>
      }
    >
      <div className="mc-stack">
        {error && <Banner tone="danger">{error}</Banner>}
        <p className="mc-small mc-muted" style={{ margin: 0 }}>
          De-identified for external review: staff email addresses are replaced by role and account number, and attempted sign-in addresses are
          removed. The export itself is recorded in this log.
        </p>
        <div className="mc-grid mc-grid-2">
          <TextField label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="To" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        </div>
        <SelectField label="Format" value={format} onChange={(e) => setFormat(e.target.value as "csv" | "pdf")}>
          <option value="csv">CSV</option>
          <option value="pdf">PDF</option>
        </SelectField>
      </div>
    </Dialog>
  );
}
