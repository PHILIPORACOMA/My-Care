import { ApiError } from "@mycare/api-client";
import {
  Async,
  Banner,
  Button,
  Card,
  DataTable,
  PageHeader,
  SelectField,
  formatDate,
  formatDateTime,
  saveBlob,
  useAsync,
} from "@mycare/ui";
import { useState } from "react";
import { api } from "../api";
import { PrivacyNote, RangeFilters, useRangeFilters } from "./filters";

/**
 * Figure 34, Data & Reports (UT-018). Every export carries the same privacy
 * guarantees as the live dashboard: de-identified, aggregated, suppressed
 * below five, and scoped to the account's barangay.
 */
export function ReportsPage() {
  const { range, setRange, today } = useRangeFilters(30);
  const [type, setType] = useState("tier_summary");
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const state = useAsync(() => api.staff.reports(), []);
  const [downloading, setDownloading] = useState<number>();

  async function generate() {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const report = await api.staff.generateReport({ type, format, from: range.from, to: range.to, barangayId: range.barangayId });
      const file = await api.staff.downloadReport(report.id);
      saveBlob(file.blob, file.filename);
      setNotice(`${report.label} downloaded as ${file.filename}.`);
      state.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function download(id: number) {
    setDownloading(id);
    try {
      const file = await api.staff.downloadReport(id);
      saveBlob(file.blob, file.filename);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(undefined);
    }
  }

  return (
    <>
      <PageHeader title="Data & reports" subtitle="Export triage data for your records and for higher-level reporting." />

      <Async state={state}>
        {(data) => (
          <div className="mc-stack">
            {error && <Banner tone="danger">{error}</Banner>}
            {notice && <Banner tone="success">{notice}</Banner>}

            <Card title="Generate a report">
              <div className="mc-row" style={{ alignItems: "flex-end", gap: 12 }}>
                <SelectField label="Report" value={type} onChange={(e) => setType(e.target.value)}>
                  {data.types.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </SelectField>
                <RangeFilters range={range} onChange={setRange} today={today} />
                <SelectField label="Format" value={format} onChange={(e) => setFormat(e.target.value as "csv" | "pdf")}>
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                </SelectField>
                <Button busy={busy} onClick={() => void generate()}>
                  Generate & download
                </Button>
              </div>
              <PrivacyNote>
                Exports inherit the dashboard's privacy rules: any bucket with fewer than five sessions is written as “&lt;5”, never a raw number. Every
                export is recorded in the audit log.
              </PrivacyNote>
            </Card>

            <Card title="Recently generated">
              <DataTable
                rows={data.reports}
                rowKey={(r) => r.id}
                empty="No reports generated yet."
                columns={[
                  { key: "label", header: "Report", render: (r) => r.label },
                  { key: "range", header: "Period", render: (r) => `${formatDate(r.from)} – ${formatDate(r.to)}` },
                  { key: "barangay", header: "Barangay", render: (r) => r.barangayName ?? "All in scope" },
                  { key: "format", header: "Format", render: (r) => r.format.toUpperCase() },
                  { key: "size", header: "Size", numeric: true, render: (r) => `${r.fileSizeKb} kB` },
                  { key: "when", header: "Generated", render: (r) => formatDateTime(r.generatedAt) },
                  {
                    key: "download",
                    header: <span className="mc-visually-hidden">Download</span>,
                    render: (r) => (
                      <Button size="sm" variant="secondary" busy={downloading === r.id} onClick={() => void download(r.id)}>
                        Download
                      </Button>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
