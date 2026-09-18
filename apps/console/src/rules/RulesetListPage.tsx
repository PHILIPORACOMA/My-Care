import type { RulesetBundle } from "@mycare/ruleset";
import type { RulesetStatus, RulesetVersionSummary } from "@mycare/api-client";
import { Async, Badge, Banner, Button, Card, DataTable, PageHeader, formatDateTime, useAsync } from "@mycare/ui";
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
 * Publish (Table 30, module 4). Nothing here is ever deleted: superseded
 * drafts and retired versions stay retrievable (UT-010).
 */
export function RulesetListPage() {
  const navigate = useNavigate();
  const state = useAsync(() => api.console.versions(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

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
        {(versions) => (
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
                    render: (v) => (v.publishedAt ? `${formatDateTime(v.publishedAt)} by ${v.publishedBy ?? "—"}` : "—"),
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
