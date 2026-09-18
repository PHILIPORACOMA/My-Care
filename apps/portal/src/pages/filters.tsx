import type { BarangayOption } from "@mycare/api-client";
import { SelectField, TextField, manilaToday, shiftDays, useAsync } from "@mycare/ui";
import { useState, type ReactNode } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export interface RangeState {
  from: string;
  to: string;
  barangayId: number | null;
}

/** The date range and barangay a screen is showing. */
export function useRangeFilters(initialDays = 30) {
  const today = manilaToday();
  const [range, setRange] = useState<RangeState>({ from: shiftDays(today, -(initialDays - 1)), to: today, barangayId: null });

  return { range, setRange, today };
}

/**
 * A sub-admin has exactly one barangay and no chooser — the server scopes
 * every query anyway (UT-016); hiding the control just avoids offering
 * something that would return nothing. A super-admin can pick one or see all.
 */
export function BarangayPicker(props: { value: number | null; onChange: (value: number | null) => void }) {
  const { user } = useAuth();
  const isScoped = user?.role === "sub_admin";
  const barangays = useAsync(() => (isScoped ? Promise.resolve([] as BarangayOption[]) : api.staff.barangays()), [isScoped]);

  if (isScoped) {
    return null;
  }

  return (
    <SelectField
      label="Barangay"
      value={props.value ?? ""}
      onChange={(e) => props.onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      <option value="">All barangays</option>
      {(barangays.data ?? []).map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </SelectField>
  );
}

export function RangeFilters(props: {
  range: RangeState;
  onChange: (range: RangeState) => void;
  today: string;
  showBarangay?: boolean;
}) {
  return (
    <>
      <TextField
        label="Start date"
        type="date"
        value={props.range.from}
        max={props.range.to}
        onChange={(e) => props.onChange({ ...props.range, from: e.target.value })}
      />
      <TextField
        label="End date"
        type="date"
        value={props.range.to}
        min={props.range.from}
        max={props.today}
        onChange={(e) => props.onChange({ ...props.range, to: e.target.value })}
      />
      {props.showBarangay !== false && (
        <BarangayPicker value={props.range.barangayId} onChange={(barangayId) => props.onChange({ ...props.range, barangayId })} />
      )}
    </>
  );
}

/** The line that appears under every figure in Figures 31–35. */
export function PrivacyNote({ children }: { children?: ReactNode }) {
  return (
    <p className="privacy-note">
      {children ?? "De-identified and aggregated. Any count below 5 is shown as “<5” so no individual can be identified."}
    </p>
  );
}
