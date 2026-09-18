import { ApiError, type SymptomCodeEntry } from "@mycare/api-client";
import { Async, Badge, Banner, Button, Card, Checkbox, DataTable, Dialog, PageHeader, TextField, useAsync } from "@mycare/ui";
import { useState } from "react";
import { api } from "../api";

/**
 * SYMPTOM_CODE (Table 6): the canonical codes rules and lexicon terms point at.
 * Codes are shared by every ruleset version, so a code locks once a reviewed or
 * published version uses it; create a new code instead of changing a locked one.
 */
export function SymptomCodesPage() {
  const state = useAsync(() => api.console.symptomCodes(), []);
  const [editing, setEditing] = useState<SymptomCodeEntry | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Symptom codes"
        subtitle="Stable identifiers shared by every ruleset version. Clinical content — add codes from the appraisal form only."
        actions={<Button onClick={() => setEditing("new")}>Add symptom code</Button>}
      />
      <Async state={state}>
        {(codes) => (
          <Card>
            <DataTable
              rows={codes}
              rowKey={(c) => c.code}
              empty="No symptom codes yet. Importing a bundle creates them."
              columns={[
                { key: "code", header: "Code", render: (c) => <span className="mc-mono">{c.code}</span> },
                { key: "name", header: "Display name", render: (c) => c.displayName },
                { key: "clar", header: "Needs clarification", render: (c) => (c.needsClarification ? "Yes" : "No") },
                { key: "lock", header: "Editable", render: (c) => (c.locked ? <Badge tone="neutral">locked</Badge> : <Badge tone="info">editable</Badge>) },
                {
                  key: "edit",
                  header: <span className="mc-visually-hidden">Edit</span>,
                  render: (c) => (
                    <Button size="sm" variant="secondary" disabled={c.locked} onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </Async>
      {editing && (
        <CodeDialog
          entry={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            state.reload();
          }}
        />
      )}
    </>
  );
}

function CodeDialog(props: { entry: SymptomCodeEntry | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(props.entry?.code ?? "");
  const [displayName, setDisplayName] = useState(props.entry?.displayName ?? "");
  const [needsClarification, setNeedsClarification] = useState(props.entry?.needsClarification ?? false);
  const [error, setError] = useState<ApiError | Error>();
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      if (props.entry) await api.console.updateSymptomCode(props.entry.code, { displayName, needsClarification });
      else await api.console.createSymptomCode({ code, displayName, needsClarification });
      props.onSaved();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (f: string) => (error instanceof ApiError ? error.fieldError(f) : undefined);

  return (
    <Dialog
      open
      title={props.entry ? `Edit ${props.entry.code}` : "Add symptom code"}
      onClose={props.onClose}
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button busy={busy} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="mc-stack">
        {error && !(error instanceof ApiError && error.status === 422) && <Banner tone="danger">{error.message}</Banner>}
        <TextField
          label="Code"
          value={code}
          disabled={props.entry !== null}
          hint="Lower case letters, numbers and underscores. Cannot change later."
          error={fieldError("code")}
          onChange={(e) => setCode(e.target.value)}
        />
        <TextField label="Display name" value={displayName} error={fieldError("displayName")} onChange={(e) => setDisplayName(e.target.value)} />
        <Checkbox checked={needsClarification} onChange={setNeedsClarification}>
          Needs a clarification question before triage (Figure 23)
        </Checkbox>
      </div>
    </Dialog>
  );
}
