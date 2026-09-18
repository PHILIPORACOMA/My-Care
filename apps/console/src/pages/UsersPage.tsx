import { ApiError, type BarangayOption, type ConsoleUser } from "@mycare/api-client";
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
  formatDate,
  useAsync,
} from "@mycare/ui";
import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

type Editing =
  | { kind: "create" }
  | { kind: "password"; user: ConsoleUser }
  | { kind: "barangay"; user: ConsoleUser }
  | { kind: "deactivate"; user: ConsoleUser };

/**
 * Figure 38, User Management (UT-019).
 *
 * The figure labels sub-admins "RHU" or "LGU"; the schema has a single sub-admin
 * role and nowhere to store which, so the role column shows "Sub-admin".
 * Status and creation date come from the API, which derives them without extra
 * columns (see AccountManager).
 */
export function UsersPage() {
  const { user: me } = useAuth();
  const users = useAsync(() => Promise.all([api.console.users(), api.staff.barangays()]), []);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, setNotice] = useState<string>();

  const done = (message: string) => {
    setEditing(null);
    setNotice(message);
    users.reload();
  };

  return (
    <>
      <PageHeader
        title="User management"
        subtitle="Sub-admin accounts for RHU and LGU staff, each scoped to one barangay."
        actions={<Button onClick={() => setEditing({ kind: "create" })}>Add account</Button>}
      />
      {notice && <Banner tone="success">{notice}</Banner>}

      <Async state={users}>
        {([list, barangays]) => (
          <>
            <Card>
              <DataTable
                rows={list}
                rowKey={(u) => u.id}
                caption="Staff accounts"
                columns={[
                  { key: "email", header: "Email", render: (u) => u.email },
                  { key: "role", header: "Role", render: (u) => (u.role === "super_admin" ? "Super-admin" : "Sub-admin") },
                  { key: "barangay", header: "Barangay", render: (u) => u.barangayName ?? (u.role === "super_admin" ? "All" : "—") },
                  {
                    key: "status",
                    header: "Status",
                    render: (u) => <Badge tone={u.status === "active" ? "ok" : "danger"}>{u.status}</Badge>,
                  },
                  { key: "created", header: "Created", render: (u) => formatDate(u.createdAt) },
                  {
                    key: "actions",
                    header: <span className="mc-visually-hidden">Actions</span>,
                    render: (u) => (
                      <div className="mc-row">
                        <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "password", user: u })}>
                          {u.status === "active" ? "Reset password" : "Reactivate"}
                        </Button>
                        {u.role === "sub_admin" && (
                          <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "barangay", user: u })}>
                            Change barangay
                          </Button>
                        )}
                        {u.status === "active" && u.id !== me?.id && (
                          <Button size="sm" variant="ghost" onClick={() => setEditing({ kind: "deactivate", user: u })}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </Card>

            {editing?.kind === "create" && <CreateDialog barangays={barangays} onClose={() => setEditing(null)} onDone={done} />}
            {editing?.kind === "password" && <PasswordDialog user={editing.user} onClose={() => setEditing(null)} onDone={done} />}
            {editing?.kind === "barangay" && (
              <BarangayDialog user={editing.user} barangays={barangays} onClose={() => setEditing(null)} onDone={done} />
            )}
            {editing?.kind === "deactivate" && <DeactivateDialog user={editing.user} onClose={() => setEditing(null)} onDone={done} />}
          </>
        )}
      </Async>
    </>
  );
}

function useSubmit(onDone: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | Error>();

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(undefined);
    try {
      onDone(await action());
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (field: string) => (error instanceof ApiError ? error.fieldError(field) : undefined);

  return { busy, error, run, fieldError };
}

const PASSWORD_HINT = "At least 12 characters, with letters and numbers. Share it with the person securely.";

function CreateDialog(props: { barangays: BarangayOption[]; onClose: () => void; onDone: (m: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [barangayId, setBarangayId] = useState("");
  const submit = useSubmit(props.onDone);

  return (
    <Dialog
      open
      title="Add sub-admin account"
      onClose={props.onClose}
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            busy={submit.busy}
            onClick={() =>
              void submit.run(async () => {
                const created = await api.console.createSubAdmin({ email, password, barangayId: Number(barangayId) });
                return `${created.email} can now sign in to the portal for ${created.barangayName}.`;
              })
            }
          >
            Create account
          </Button>
        </>
      }
    >
      <div className="mc-stack">
        {submit.error && !(submit.error instanceof ApiError && submit.error.status === 422) && <Banner tone="danger">{submit.error.message}</Banner>}
        <TextField label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={submit.fieldError("email")} />
        <TextField
          label="Initial password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={submit.fieldError("password")}
          hint={PASSWORD_HINT}
        />
        <SelectField label="Assigned barangay" value={barangayId} onChange={(e) => setBarangayId(e.target.value)} error={submit.fieldError("barangayId")}>
          <option value="">Choose a barangay</option>
          {props.barangays.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
      </div>
    </Dialog>
  );
}

function PasswordDialog(props: { user: ConsoleUser; onClose: () => void; onDone: (m: string) => void }) {
  const [password, setPassword] = useState("");
  const submit = useSubmit(props.onDone);
  const reactivating = props.user.status === "deactivated";

  return (
    <Dialog
      open
      title={reactivating ? `Reactivate ${props.user.email}` : `Reset password for ${props.user.email}`}
      onClose={props.onClose}
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            busy={submit.busy}
            onClick={() =>
              void submit.run(async () => {
                await api.console.setPassword(props.user.id, password);
                return reactivating ? `${props.user.email} is active again.` : `Password reset for ${props.user.email}.`;
              })
            }
          >
            {reactivating ? "Reactivate" : "Set password"}
          </Button>
        </>
      }
    >
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={submit.fieldError("password")}
        hint={PASSWORD_HINT}
      />
    </Dialog>
  );
}

function BarangayDialog(props: { user: ConsoleUser; barangays: BarangayOption[]; onClose: () => void; onDone: (m: string) => void }) {
  const [barangayId, setBarangayId] = useState(String(props.user.barangayId ?? ""));
  const submit = useSubmit(props.onDone);

  return (
    <Dialog
      open
      title={`Change barangay for ${props.user.email}`}
      onClose={props.onClose}
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            busy={submit.busy}
            onClick={() =>
              void submit.run(async () => {
                const updated = await api.console.reassignBarangay(props.user.id, Number(barangayId));
                return `${updated.email} now sees ${updated.barangayName} only.`;
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      {submit.error && <Banner tone="danger">{submit.error.message}</Banner>}
      <SelectField label="Barangay" value={barangayId} onChange={(e) => setBarangayId(e.target.value)}>
        {props.barangays.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectField>
    </Dialog>
  );
}

function DeactivateDialog(props: { user: ConsoleUser; onClose: () => void; onDone: (m: string) => void }) {
  const submit = useSubmit(props.onDone);

  return (
    <Dialog
      open
      title={`Deactivate ${props.user.email}?`}
      onClose={props.onClose}
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            busy={submit.busy}
            onClick={() =>
              void submit.run(async () => {
                await api.console.deactivateUser(props.user.id);
                return `${props.user.email} is deactivated and signed out.`;
              })
            }
          >
            Deactivate
          </Button>
        </>
      }
    >
      {submit.error && <Banner tone="danger">{submit.error.message}</Banner>}
      <p style={{ marginTop: 0 }}>
        They will be signed out on their next request and cannot sign in again until you set a new password. The action is recorded in the audit log.
      </p>
    </Dialog>
  );
}
