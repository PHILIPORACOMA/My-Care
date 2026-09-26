import type { LanguageCode, RulesetBundle } from "@mycare/ruleset";

/**
 * On-device storage (Table 27: IndexedDB, 100 MB budget).
 *
 * Three stores, and a deliberate absence:
 *
 *   prefs   language, barangay, age confirmation, device credential, bundle
 *   queue   finished sessions waiting to upload
 *   facilities  emergency contacts for "Call for help" (Figure 27)
 *
 * **What a patient typed is never stored.** Free text lives in React state for
 * the length of one check and is gone when the screen changes; only resolved
 * symptom codes are queued. That is the schema-level privacy rule
 * (CLAUDE.md #8) applied on the device, where it starts.
 *
 * Written against the raw IndexedDB API rather than a wrapper library — one
 * fewer dependency on a 2 GB phone, and the surface used here is small.
 */

const DB_NAME = "mycare";
const DB_VERSION = 1;
const PREFS = "prefs";
const QUEUE = "queue";

export interface DeviceCredential {
  id: number;
  token: string;
  barangayId: number;
}

export interface CachedBundle {
  versionLabel: string;
  publishedAt: string | null;
  fetchedAt: string;
  bundle: RulesetBundle;
}

export interface Facility {
  id: number;
  barangayId: number | null;
  name: string;
  type: string;
  contactNumber: string | null;
  address: string | null;
  operatingHours: string | null;
}

export interface Barangay {
  id: number;
  name: string;
  city: string;
}

/**
 * The barangay the patient chose. `id` is null while the choice came from the
 * list shipped in the app and the server has not yet confirmed it
 * (barangays.ts); it is filled in at first contact, before anything can be
 * triaged.
 */
export type ChosenBarangay = Omit<Barangay, "id"> & { id: number | null };

/** One finished triage, in the shape the sync endpoint accepts. */
export interface QueuedSession {
  client_session_uuid: string;
  barangay_id: number;
  ruleset_version_label: string;
  matched_rule_code: string | null;
  language: LanguageCode;
  started_at: string;
  completed_at: string;
  symptoms: { symptom_code: string; negated: boolean; matched_term: { term: string; language: string } | null }[];
  clarification_answers: { question_key: string; answer: string; is_red_flag: boolean }[];
}

export interface Prefs {
  language?: LanguageCode;
  barangay?: ChosenBarangay;
  ageConfirmed?: boolean;
  device?: DeviceCredential;
  bundle?: CachedBundle;
  facilities?: Facility[];
  barangays?: Barangay[];
  lastSyncAt?: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PREFS)) db.createObjectStore(PREFS);
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: "client_session_uuid" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = action(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      })
  );
}

export async function readPrefs(): Promise<Prefs> {
  const value = await run<Prefs | undefined>(PREFS, "readonly", (store) => store.get("prefs") as IDBRequest<Prefs | undefined>);
  return value ?? {};
}

export async function writePrefs(changes: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await readPrefs()), ...changes };
  await run(PREFS, "readwrite", (store) => store.put(next, "prefs"));
  return next;
}

export async function enqueueSession(session: QueuedSession): Promise<void> {
  await run(QUEUE, "readwrite", (store) => store.put(session));
}

export async function queuedSessions(): Promise<QueuedSession[]> {
  return (await run<QueuedSession[]>(QUEUE, "readonly", (store) => store.getAll() as IDBRequest<QueuedSession[]>)) ?? [];
}

export async function dequeueSessions(uuids: string[]): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(QUEUE, "readwrite");
    const store = transaction.objectStore(QUEUE);
    uuids.forEach((uuid) => store.delete(uuid));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function queueLength(): Promise<number> {
  return (await run<number>(QUEUE, "readonly", (store) => store.count())) ?? 0;
}

/** Settings → "Start over (clear data)" (Figure 29). */
export async function clearEverything(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([PREFS, QUEUE], "readwrite");
    transaction.objectStore(PREFS).clear();
    transaction.objectStore(QUEUE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
