import { ApiError, type RulesetContent, type RulesetVersionSummary, type SymptomCodeEntry } from "@mycare/api-client";
import { Async, Badge, Banner, Button, Checkbox, Dialog, PageHeader, formatDateTime, useAsync } from "@mycare/ui";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { LexiconEditor, QuestionsEditor, RulesEditor, ThresholdsEditor, TipsEditor, type EditorProps } from "./editors";
import { STATUS_LABEL, STATUS_TONE } from "./RulesetListPage";
import { TestPanel } from "./TestPanel";

type Tab = "rules" | "thresholds" | "questions" | "lexicon" | "tips" | "test";

const TABS: { key: Tab; label: string }[] = [
  { key: "rules", label: "Rules" },
  { key: "thresholds", label: "Thresholds & red flags" },
  { key: "questions", label: "Clarification questions" },
  { key: "lexicon", label: "Lexicon" },
  { key: "tips", label: "Health tips" },
  { key: "test", label: "Test & explain" },
];

/**
 * Figure 39 — one ruleset version. A draft is editable; saving creates a new
 * version (UT-010) and this page moves to it. Anything else is read-only, with
 * the one lifecycle action that makes sense for its state.
 */
export function RulesetVersionPage() {
  const id = Number(useParams().id);
  const state = useAsync(() => Promise.all([api.console.version(id), api.console.symptomCodes()]), [id]);

  return (
    <Async state={state}>
      {([{ version, content }, codes]) => <VersionEditor key={version.id} version={version} initial={content} codes={codes} reload={state.reload} />}
    </Async>
  );
}

function VersionEditor(props: { version: RulesetVersionSummary; initial: RulesetContent; codes: SymptomCodeEntry[]; reload: () => void }) {
  const { version, codes } = props;
  const navigate = useNavigate();
  const [content, setContent] = useState(props.initial);
  const [tab, setTab] = useState<Tab>("rules");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | Error>();
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string>();

  const editable = version.status === "draft";
  const dirty = useMemo(() => JSON.stringify(content) !== JSON.stringify(props.initial), [content, props.initial]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const fieldErrors = error instanceof ApiError ? error.errors : {};
  const errorFor = (path: string) => fieldErrors[path]?.[0];

  async function run(action: () => Promise<RulesetVersionSummary>, message: string, openResult = false) {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await action();
      if (openResult && result.id !== version.id) {
        navigate(`/rules/${result.id}`);
      } else {
        setNotice(message);
        props.reload();
      }
    } catch (e) {
      setError(e as Error);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  const editorProps: EditorProps = { content, onChange: setContent, codes, readOnly: !editable, errorFor };
  const errorCount = Object.keys(fieldErrors).length;

  return (
    <>
      <PageHeader
        title={`Ruleset ${version.label}`}
        subtitle={
          <span className="mc-row">
            <Badge tone={STATUS_TONE[version.status]}>{STATUS_LABEL[version.status]}</Badge>
            {version.publishedAt && (
              <span className="mc-small">
                Published {formatDateTime(version.publishedAt)} by {version.publishedBy}
              </span>
            )}
            <Link to="/rules" className="mc-small">
              All versions
            </Link>
          </span>
        }
        actions={
          <>
            {version.status === "draft" && (
              <>
                <Button variant="secondary" busy={busy} disabled={!dirty} onClick={() => void run(() => api.console.saveContent(version.id, content), "", true)}>
                  Save as new version
                </Button>
                <Button busy={busy} disabled={dirty} title={dirty ? "Save your changes first" : undefined} onClick={() => void run(() => api.console.submitForReview(version.id), "Submitted for clinical review. The content is now frozen.")}>
                  Submit for clinical review
                </Button>
              </>
            )}
            {version.status === "in_review" && (
              <>
                <Button variant="secondary" busy={busy} onClick={() => void run(() => api.console.returnToDraft(version.id), "Returned to draft for changes.")}>
                  Return to draft
                </Button>
                <Button busy={busy} onClick={() => setPublishing(true)}>
                  Publish to devices
                </Button>
              </>
            )}
            {(version.status === "published" || version.status === "retired" || version.status === "superseded") && (
              <Button variant="secondary" busy={busy} onClick={() => void run(() => api.console.createDraft(version.id), "", true)}>
                New draft from {version.label}
              </Button>
            )}
            {version.status === "retired" && (
              <Button variant="danger" busy={busy} onClick={() => void run(() => api.console.rollback(version.id), "", true)}>
                Roll back to {version.label}
              </Button>
            )}
          </>
        }
      />

      <div className="mc-stack mc-mb-4">
        {notice && <Banner tone="success">{notice}</Banner>}
        {error && (
          <Banner tone="danger" title={error.message}>
            {errorCount > 0 && (
              <ul className="error-list">
                {Object.entries(fieldErrors)
                  .slice(0, 12)
                  .map(([path, messages]) => (
                    <li key={path}>
                      <code>{path}</code>: {messages[0]}
                    </li>
                  ))}
              </ul>
            )}
          </Banner>
        )}
        {!editable && version.status !== "draft" && tab !== "test" && (
          <Banner tone="info">
            {version.status === "published"
              ? "This is the live version. It cannot change; start a new draft to make changes."
              : "This version is read-only."}
          </Banner>
        )}
        {editable && dirty && <Banner tone="warning">Unsaved changes. Saving creates a new version; this draft is kept as history.</Banner>}
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === "lexicon" ? ` (${content.lexiconTerms.length})` : t.key === "rules" ? ` (${content.rules.length})` : ""}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "rules" && <RulesEditor {...editorProps} />}
        {tab === "thresholds" && <ThresholdsEditor {...editorProps} />}
        {tab === "questions" && <QuestionsEditor {...editorProps} />}
        {tab === "lexicon" && <LexiconEditor {...editorProps} />}
        {tab === "tips" && <TipsEditor {...editorProps} />}
        {tab === "test" && <TestPanel content={content} codes={codes} versionLabel={version.label} />}
      </div>

      {publishing && (
        <PublishDialog
          label={version.label}
          busy={busy}
          onClose={() => setPublishing(false)}
          onConfirm={() => {
            setPublishing(false);
            void run(() => api.console.publish(version.id, true), `${version.label} is published. Devices receive it on their next check.`);
          }}
        />
      )}
    </>
  );
}

/**
 * Figure 11: no rule change reaches patients without clinical review. The
 * software cannot verify a clinician's sign-off, so the publisher attests to it
 * and the audit log records who did.
 */
function PublishDialog(props: { label: string; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Dialog
      open
      title={`Publish ${props.label} to every device?`}
      onClose={props.onClose}
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button disabled={!confirmed} busy={props.busy} onClick={props.onConfirm}>
            Publish
          </Button>
        </>
      }
    >
      <div className="mc-stack">
        <p className="mc-flush">
          Patients' phones download it on their next connection and triage against it from then on. The current published version is retired and can be
          rolled back to.
        </p>
        <Checkbox checked={confirmed} onChange={setConfirmed}>
          I confirm this version's rules, thresholds, questions, lexicon and health tips were reviewed and approved by the project adviser or a qualified
          health professional.
        </Checkbox>
      </div>
    </Dialog>
  );
}
