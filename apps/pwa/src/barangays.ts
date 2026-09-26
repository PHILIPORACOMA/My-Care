import type { Barangay, ChosenBarangay } from "./storage";

/*
 * The barangay list shipped inside the app, so a phone can choose its
 * barangay before it has ever had signal (UT-001).
 *
 * NAMES ONLY. A barangay's id is an auto-increment number assigned by
 * whichever server seeded it, in whatever order, and the City Health Office
 * may still correct the list (ADR-0005). An id shipped in the app could
 * silently count every session under the wrong barangay, which is the one
 * thing surveillance data cannot survive. So a choice made from this list
 * carries no id; the server's id is looked up by name at first contact, the
 * same moment the device registers and downloads its rules, and nothing can
 * be triaged before that.
 *
 * Must match apps/api/database/seeders/BarangaySeeder.php NAMES exactly;
 * barangays.test.ts reads that file and fails if the two drift.
 */
export const BUNDLED_BARANGAY_NAMES = [
  "Bolinawan",
  "Buenavista",
  "Calidngan",
  "Can-asujan",
  "Guadalupe",
  "Liburon",
  "Napo",
  "Ocana",
  "Perrelos",
  "Poblacion I",
  "Poblacion II",
  "Poblacion III",
  "Tuyom",
  "Valencia",
  "Valladolid",
] as const;

export const CITY = "Carcar City";

/** The shipped list, in the same shape as the server's, minus the ids. */
export function bundledBarangays(): ChosenBarangay[] {
  return BUNDLED_BARANGAY_NAMES.map((name) => ({ id: null, name, city: CITY }));
}

function normalise(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The server's entry for a chosen barangay, matched by name (case and spacing
 * ignored). Undefined when the server has no such barangay - renamed or
 * removed - in which case the patient must choose again; never guess.
 */
export function resolveBarangay(choice: ChosenBarangay, serverList: Barangay[]): Barangay | undefined {
  const wanted = normalise(choice.name);
  return serverList.find((b) => normalise(b.name) === wanted);
}
