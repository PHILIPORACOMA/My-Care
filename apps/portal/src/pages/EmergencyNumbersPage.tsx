import type { FacilityEntry } from "@mycare/api-client";
import { Async, Banner, Card, DataTable, PageHeader, facilityTypeLabel, useAsync } from "@mycare/ui";
import { api } from "../api";

/**
 * Read-only: the numbers the patient app's emergency "Call for help" gives
 * patients in this account's barangay (Figure 27, ADR-0005).
 *
 * RHU staff can see what their patients are told to call and notice a wrong
 * or outdated number. Changing one is the super-admin's job, in the console;
 * this screen has no way to edit, on purpose, so a number only ever changes
 * through the audited, confirmed path.
 */

/** The order "Call for help" prefers them in: hotlines, then RHUs, then the rest. */
const PREFERENCE: Record<string, number> = { emergency_hotline: 0, rhu: 1 };
const byPreference = (a: FacilityEntry, b: FacilityEntry) => (PREFERENCE[a.type] ?? 2) - (PREFERENCE[b.type] ?? 2) || a.name.localeCompare(b.name);

export function EmergencyNumbersPage() {
  const state = useAsync(() => api.staff.facilities(), []);

  return (
    <>
      <PageHeader title="Emergency numbers" subtitle={'What the patient app\'s "Call for help" button dials for your barangay.'} />
      <Async state={state}>
        {(facilities) => (
          <div className="mc-stack">
            <Banner tone="info" title="Is a number wrong or out of date?">
              Send the correct number to the My Care system administrator, who updates it. Patients&apos; phones receive the change the next time they
              open the app with signal.
            </Banner>
            {facilities.filter((f) => f.contactNumber).length === 0 && (
              <Banner tone="warning" title="No numbers set up">
                {'Until one is added, "Call for help" dials the national emergency number 911.'}
              </Banner>
            )}
            <Card title="Numbers patients may be given">
              <DataTable
                rows={[...facilities].sort(byPreference)}
                rowKey={(f) => f.id}
                caption="Emergency numbers"
                empty="No facilities are set up for your barangay."
                columns={[
                  { key: "name", header: "Facility", render: (f) => f.name },
                  { key: "type", header: "Type", render: (f) => facilityTypeLabel(f.type) },
                  { key: "serves", header: "Serves", render: (f) => f.barangayName ?? "City-wide" },
                  { key: "number", header: "Number", render: (f) => <span className="mc-mono">{f.contactNumber ?? "—"}</span> },
                  { key: "hours", header: "Hours", render: (f) => f.operatingHours ?? "—" },
                ]}
              />
              <p className="mc-muted">
                {'"Call for help" prefers an emergency hotline, then an RHU, choosing your barangay\'s own before a city-wide one.'}
              </p>
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
