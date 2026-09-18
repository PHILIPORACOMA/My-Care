import type { BarangayOption } from "@mycare/api-client";
import { SelectField, TextField, manilaToday, shiftDays, useAsync } from "@mycare/ui";
import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export interface RangeState {
  from: string;
  to: string;
  barangayId: number | null;
}

/**
 * The date range and barangay a screen is showing.
 *
 * A sub-admin has exactly one barangay and no chooser — the server scopes every
 * query anyway (UT-016); hiding the control just avoids offering something that
 * would return nothing. A super-admin can look at one barangay or all of them.
 */
export function useRangeFilters(initialDays = 30) {
  const today = manilaToday();
  const [range, setRange] = useState<RangeState>({ from: shiftDays(today, -(initialDays - 1)), to: today, barangayId: null });

  return { range, setRange, today };
}

export function RangeFilters(props: {
  range: RangeState;
  onChange: (range: RangeState) => void;
  today: string;
  showBarangay?: boolean;
}) {
  const { user } = useAuth();
  const isScoped = user?.role === "sub_admin";
  const barangays = useAsync(() => (isScoped ? Promise.resolve([]) : api.staff.barangays()), [isScoped]);

  return (
    <>
      <TextField
        label="From"
        type="date"
        value={props.range.from}
        max={props.range.to}
        onChange={(e) => props.onChange({ ...props.range, from: e.target.value })}
      />
      <TextField
        label="To"
        type="date"
        value={props.range.to}
        min={props.range.from}
        max={props.today}
        onChange={(e) => props.onChange({ ...props.range, to: e.target.value })}
      />
      {props.showBarangay !== false && !isScoped && (
        <SelectField
          label="Barangay"
          value={props.range.barangayId ?? ""}
          onChange={(e) => props.onChange({ ...props.range, barangayId: e.target.value === "" ? null : Number(e.target.value) })}
        >
          <option value="">All barangays</option>
          {(barangays.data ?? []).map((b: BarangayOption) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
      )}
    </>
  );
}

/** The line that appears under every figure in Figures 31–35. */
export function PrivacyNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="privacy-note">
      {children ?? "De-identified and aggregated. Any count below 5 is shown as “<5” so no individual can be identified."}
    </p>
  );
}
