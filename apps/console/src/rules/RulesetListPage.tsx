import type { RulesetBundle } from "@mycare/ruleset";
import type { RulesetStatus, RulesetVersionSummary } from "@mycare/api-client";
import { Async, Badge, Banner, Button, Card, DataTable, Dialog, PageHeader, formatDateTime, useAsync } from "@mycare/ui";
import { useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export const STATUS_TONE: Record<RulesetStatus, "ok" | "warn" | "info" | "neutral" | "danger"> = {
  published: "ok",
  in_review: "warn",
  draft: "info",
  superseded: "neutral",
  retired: "neutral",
};

export const STATUS_LABEL: Record<RulesetStatus, string> = {
  published: "Published",
  in_review: "In clinical review",
  draft: "Draft",
  superseded: "Superseded draft",
  retired: "Retired",
};

/**
 * Figure 39 — every ruleset version and where it is in Draft → Review →
 * Publish (Table 30, module 4). A draft that never went to review can be
 * deleted (a mistaken "New draft", unfinished work). Everything else is kept:
 * superseded drafts and retired versions stay retrievable (UT-010, ADR-0006),
 * and only sit behind "Show older versions" so the list stays readable.
 */

/** Saved-over drafts and replaced versions: history, collapsed by default. */
const OLDER: RulesetStatus[] = ["superseded", "retired"];
export function RulesetListPage() {
  const navigate = useNavigate();
  const state = useAsync(() => api.console.versions(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [showOlder, setShowOlder] = useState(false);
  const [deleting, setDeleting] = useState<RulesetVersionSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string>();

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(undefined);
    try {
      await api.console.deleteDraft(deleting.id);
      setDeleting(null);
      state.reload();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(action: () => Promise<RulesetVersionSummary>) {
    setBusy(true);
    setError(undefined);
    try {
      const version = await action();
      navigate(`/rules/${version.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    let bundle: RulesetBundle;
    try {
      bundle = JSON.parse(await file.text()) as RulesetBundle;
    } catch {
      setError("That file is not valid JSON.");
      return;
    }
    await act(() => api.console.importBundle(bundle));
  }

  return (
    <>
      <PageHeader
        title="Triage rules & lexicon"
        subtitle="Changes are staged as drafts, clinically reviewed, then published to devices."
        actions={
          <>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => void importFile(e)} />
            <Button variant="secondary" busy={busy} onClick={() => fileInput.current?.click()}>
              Import bundle JSON
            </Button>
            <Async state={state}>
              {(versions) => {
                const published = versions.find((v) => v.status === "published");
                return (
                  <Button busy={busy} onClick={() => void act(() => api.console.createDraft(published?.id))}>
                    {published ? `New draft from ${published.label}` : "New empty draft"}
                  </Button>
                );
              }}
            </Async>
          </>
        }
      />

      {error && <Banner tone="danger">{error}</Banner>}

      <Async state={state}>
        {(allVersions) => {
          const older = allVersions.filter((v) => OLDER.includes(v.status));
          const versions = showOlder ? allVersions : allVersions.filter((v) => !OLDER.includes(v.status));
          return (
            <div className="mc-stack">
              {!versions.some((v) => v.status === "published") && (
                <Banner tone="warning" title="No ruleset is published">
                  Devices cannot triage until a version is reviewed and published. To start from the v1 presentations, run{" "}
                  <code>npm run export:v1 -w @mycare/ruleset</code> and import <code>packages/ruleset/dist/v1.json</code> here.
                </Banner>
              )}
              <Card>
                <DataTable
                  rows={versions}
                  rowKey={(v) => v.id}
                  empty="No versions yet."
                  columns={[
                    {
                      key: "label",
                      header: "Version",
                      render: (v) => (
                        <Link to={`/rules/${v.id}`} className="mc-mono">
                          {v.label}
                        </Link>
                      ),
                    },
                    { key: "status", header: "Status", render: (v) => <Badge tone={STATUS_TONE[v.status]}>{STATUS_LABEL[v.status]}</Badge> },
                    { key: "rules", header: "Rules", numeric: true, render: (v) => v.counts?.rules ?? "—" },
                    { key: "lexicon", header: "Lexicon terms", numeric: true, render: (v) => v.counts?.lexiconTerms ?? "—" },
                    { key: "thresholds", header: "Thresholds", numeric: true, render: (v) => v.counts?.severityThresholds ?? "—" },
                    { key: "questions", header: "Questions", numeric: true, render: (v) => v.counts?.clarificationQuestions ?? "—" },
                    { key: "tips", header: "Health tips", numeric: true, render: (v) => v.counts?.healthTips ?? "—" },
                    {
                      key: "published",
                      header: "Published",
                      render: (v) =>
                        v.publishedAt ? (
                          <>
                            {formatDateTime(v.publishedAt)} by {v.publishedBy ?? "—"}
                            <div className="mc-small mc-muted">Reviewed and approved by: {v.reviewedBy ?? "not recorded"}</div>
                          </>
                        ) : (
                          "—"
                        ),
                    },
                    {
                      key: "actions",
                      header: <span className="mc-visually-hidden">Actions</span>,
                      render: (v) =>
                        v.status === "draft" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setDeleteError(undefined);
                              setDeleting(v);
                            }}
                          >
                            Delete
                          </Button>
                        ) : null,
                    },
                  ]}
                />
              </Card>
              {older.length > 0 && (
                <div>
                  <Button size="sm" variant="ghost" onClick={() => setShowOlder((open) => !open)}>
                    {showOlder ? "Hide older versions" : `Show older versions (${older.length})`}
                  </Button>
                </div>
              )}
            </div>
          );
        }}
      </Async>

      {deleting && (
        <Dialog
          open
          title={`Delete ${deleting.label}?`}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button variant="danger" busy={busy} onClick={() => void confirmDelete()}>
                Delete {deleting.label}
              </Button>
            </>
          }
        >
          <div className="mc-stack">
            {deleteError && <Banner tone="danger">{deleteError}</Banner>}
            <p>
              This draft holds {deleting.counts?.rules ?? 0} rules, {deleting.counts?.lexiconTerms ?? 0} lexicon terms,{" "}
              {deleting.counts?.severityThresholds ?? 0} thresholds, {deleting.counts?.clarificationQuestions ?? 0} questions and{" "}
              {deleting.counts?.healthTips ?? 0} health tips. <strong>It cannot be recovered.</strong>
            </p>
            <p>It was never published, so phones are not affected. The audit log keeps a record that it was deleted, by whom, and what it held.</p>
          </div>
        </Dialog>
      )}
    </>
  );
}
