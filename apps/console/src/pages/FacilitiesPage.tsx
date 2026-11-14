import { ApiError, type BarangayOption, type FacilityEntry, type FacilityInput } from "@mycare/api-client";
import { Async, Badge, Banner, Button, Card, DataTable, Dialog, PageHeader, SelectField, TextField, facilityTypeLabel, useAsync } from "@mycare/ui";
import { useState } from "react";
import { api } from "../api";

/**
 * The numbers behind the patient app's emergency "Call for help" (Figure 27,
 * ADR-0005). When an RHU reports a new number, the super-admin changes it here.
 *
 * A wrong number on an emergency screen can cost a life, so every save shows
 * the old and new number side by side before it is sent, deactivating the last
 * number warns that phones will fall back to 911, and the API audits every
 * change with the value it replaced.
 */

/** Facilities "Call for help" can actually dial: active and with a number. */
const dialable = (facilities: FacilityEntry[]) => facilities.filter((f) => f.isActive && f.contactNumber);

type Editing = { kind: "edit"; facility: FacilityEntry } | { kind: "new" } | { kind: "toggle"; facility: FacilityEntry } | null;

export function FacilitiesPage() {
  const state = useAsync(() => Promise.all([api.console.facilities(), api.staff.barangays()]), []);
  const [editing, setEditing] = useState<Editing>(null);

  const done = () => {
    setEditing(null);
    state.reload();
  };

  return (
    <>
      <PageHeader
        title="Emergency numbers"
        subtitle={'The numbers the patient app\'s "Call for help" dials. Change one when an RHU reports a new number.'}
        actions={<Button onClick={() => setEditing({ kind: "new" })}>Add facility</Button>}
      />
      <Async state={state}>
        {([{ facilities, suggestedTypes }, barangays]) => (
          <div className="mc-stack">
            <Banner tone="info" title="Phones update when they next have signal">
              A phone receives a change the next time the app opens with a connection. A phone that stays offline keeps calling the number it last
              downloaded.
            </Banner>
            {dialable(facilities).length === 0 && (
              <Banner tone="warning" title="No active numbers">
                {'"Call for help" falls back to the national emergency number 911 until a facility with a number is active.'}
              </Banner>
            )}
            <Card>
              <DataTable
                rows={facilities}
                rowKey={(f) => f.id}
                caption="Emergency numbers"
                empty="No facilities yet. Add one, or import the City Health Office's list with php artisan mycare:facilities:import."
                columns={[
                  { key: "name", header: "Facility", render: (f) => f.name },
                  { key: "type", header: "Type", render: (f) => facilityTypeLabel(f.type) },
                  { key: "barangay", header: "Serves", render: (f) => f.barangayName ?? "City-wide" },
                  { key: "number", header: "Number", render: (f) => <span className="mc-mono">{f.contactNumber ?? "—"}</span> },
                  { key: "hours", header: "Hours", render: (f) => f.operatingHours ?? "—" },
                  { key: "status", header: "Status", render: (f) => (f.isActive ? <Badge tone="ok">active</Badge> : <Badge tone="neutral">inactive</Badge>) },
                  {
                    key: "actions",
                    header: <span className="mc-visually-hidden">Actions</span>,
                    render: (f) => (
                      <div className="mc-row">
                        <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "edit", facility: f })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ kind: "toggle", facility: f })}>
                          {f.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>

            {(editing?.kind === "edit" || editing?.kind === "new") && (
              <FacilityDialog
                facility={editing.kind === "edit" ? editing.facility : null}
                barangays={barangays}
                suggestedTypes={suggestedTypes}
                onClose={() => setEditing(null)}
                onSaved={done}
              />
            )}
            {editing?.kind === "toggle" && (
              <ToggleDialog
                facility={editing.facility}
                lastNumber={editing.facility.isActive && dialable(facilities).every((f) => f.id === editing.facility.id)}
                onClose={() => setEditing(null)}
                onDone={done}
              />
            )}
          </div>
        )}
      </Async>
    </>
  );
}

function FacilityDialog(props: {
  facility: FacilityEntry | null;
  barangays: BarangayOption[];
  suggestedTypes: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const f = props.facility;
  const [form, setForm] = useState<FacilityInput>({
    name: f?.name ?? "",
    type: f?.type ?? "rhu",
    barangayId: f?.barangayId ?? null,
    contactNumber: f?.contactNumber ?? "",
    address: f?.address ?? null,
    operatingHours: f?.operatingHours ?? null,
  });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ApiError | Error>();
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FacilityInput>(key: K, value: FacilityInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const fieldError = (field: string) => (error instanceof ApiError ? error.fieldError(field) : undefined);
  const types = props.suggestedTypes.includes(form.type) ? props.suggestedTypes : [...props.suggestedTypes, form.type];
  const serves = form.barangayId === null ? "every barangay" : (props.barangays.find((b) => b.id === form.barangayId)?.name ?? "this barangay");
  const numberChanged = f !== null && f.contactNumber !== form.contactNumber.trim();

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      if (f) await api.console.updateFacility(f.id, form);
      else await api.console.createFacility(form);
      props.onSaved();
    } catch (e) {
      // Back to the form, so a field error shows beside its field.
      setConfirming(false);
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <Dialog
        open
        title={f ? "Confirm the change" : "Confirm the new facility"}
        onClose={props.onClose}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Back
            </Button>
            <Button busy={busy} onClick={() => void save()}>
              {f ? "Save change" : "Add facility"}
            </Button>
          </>
        }
      >
        <div className="mc-stack">
          <p>
            <strong>{form.name}</strong> · {facilityTypeLabel(form.type)} · serves {serves}
          </p>
          <dl className="number-check">
            {numberChanged && (
              <>
                <dt>Old number</dt>
                <dd className="mc-mono is-old">
                  <s>{f.contactNumber ?? "none"}</s>
                </dd>
              </>
            )}
            <dt>{numberChanged ? "New number" : f ? "Number (unchanged)" : "Number"}</dt>
            <dd className="mc-mono">
              <strong>{form.contactNumber.trim()}</strong>
            </dd>
          </dl>
          <Banner tone="warning">
            {'Patients in '}
            {serves}
            {' may be given this number by "Call for help". Check it digit by digit against what the RHU sent before saving.'}
          </Banner>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      title={f ? `Edit ${f.name}` : "Add facility"}
      onClose={props.onClose}
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button onClick={() => setConfirming(true)} disabled={form.name.trim() === "" || form.contactNumber.trim() === ""}>
            Review
          </Button>
        </>
      }
    >
      <div className="mc-stack">
        {error && !(error instanceof ApiError && error.status === 422) && <Banner tone="danger">{error.message}</Banner>}
        <TextField label="Facility name" value={form.name} error={fieldError("name")} onChange={(e) => set("name", e.target.value)} />
        <TextField
          label="Contact number"
          inputMode="tel"
          value={form.contactNumber}
          error={fieldError("contactNumber")}
          hint="Digits, spaces, hyphens, brackets and a leading +. This is what the patient's phone dials."
          onChange={(e) => set("contactNumber", e.target.value)}
        />
        <SelectField label="Type" value={form.type} error={fieldError("type")} onChange={(e) => set("type", e.target.value)}
          hint={'"Call for help" prefers an emergency hotline, then an RHU.'}>
          {types.map((t) => (
            <option key={t} value={t}>
              {facilityTypeLabel(t)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Serves"
          value={form.barangayId === null ? "" : String(form.barangayId)}
          error={fieldError("barangayId")}
          onChange={(e) => set("barangayId", e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">City-wide (every barangay)</option>
          {props.barangays.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Operating hours (optional)" value={form.operatingHours ?? ""} error={fieldError("operatingHours")}
          onChange={(e) => set("operatingHours", e.target.value || null)} />
        <TextField label="Address (optional)" value={form.address ?? ""} error={fieldError("address")} onChange={(e) => set("address", e.target.value || null)} />
      </div>
    </Dialog>
  );
}

function ToggleDialog(props: { facility: FacilityEntry; lastNumber: boolean; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const deactivating = props.facility.isActive;

  async function go() {
    setBusy(true);
    try {
      await api.console.updateFacility(props.facility.id, { isActive: !deactivating });
      props.onDone();
    } catch (e) {
      setError(e as Error);
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title={`${deactivating ? "Deactivate" : "Reactivate"} ${props.facility.name}?`}
      onClose={props.onClose}
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button busy={busy} variant={deactivating ? "danger" : "primary"} onClick={() => void go()}>
            {deactivating ? "Deactivate" : "Reactivate"}
          </Button>
        </>
      }
    >
      <div className="mc-stack">
        {error && <Banner tone="danger">{error.message}</Banner>}
        <p>
          {deactivating
            ? 'Phones stop offering this number once they next have signal. Nothing is deleted; you can reactivate it.'
            : `Phones start offering ${props.facility.contactNumber ?? "this facility"} once they next have signal.`}
        </p>
        {deactivating && props.lastNumber && (
          <Banner tone="warning" title="This is the last active number">
            {'With it gone, "Call for help" on every phone falls back to the national emergency number 911.'}
          </Banner>
        )}
      </div>
    </Dialog>
  );
}
