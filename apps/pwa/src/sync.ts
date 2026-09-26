import { OfflineError, deviceApi } from "./api";
import {
  dequeueSessions,
  queueLength,
  queuedSessions,
  readPrefs,
  writePrefs,
  type CachedBundle,
  type DeviceCredential,
  type QueuedSession,
} from "./storage";

/**
 * The offline sync layer (Phase 6, UT-012, UT-013, UT-015).
 *
 * Rules this follows, in order of importance:
 *
 * 1. **A finished check is never lost.** It is written to IndexedDB before any
 *    upload is attempted, and only removed once the server has acknowledged
 *    it. A phone that dies mid-upload still has it.
 * 2. **A retry can never double-count.** The batch uuid is created with the
 *    batch and reused for every attempt; the server answers a replay with the
 *    original result (ADR-0003).
 * 3. **Offline is normal, not an error.** Failures are silent to the patient:
 *    the queue simply drains later. Only a rejected batch (422 — content the
 *    server will never accept) is kept aside rather than retried forever.
 */

const BATCH_LIMIT = 50;

export interface SyncState {
  pending: number;
  lastSyncAt?: string;
  bundle?: CachedBundle;
  syncing: boolean;
}

type Listener = (state: SyncState) => void;

let batchUuid: string | null = null;
let syncing = false;
const listeners = new Set<Listener>();
let state: SyncState = { pending: 0, syncing: false };

function emit(changes: Partial<SyncState>): void {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener(state));
}

export function onSyncState(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function syncState(): SyncState {
  return state;
}

export async function refreshPending(): Promise<number> {
  const pending = await queueLength();
  emit({ pending });
  return pending;
}

/** Queue one finished check, then try to send straight away. */
export async function recordSession(session: QueuedSession): Promise<void> {
  const { enqueueSession } = await import("./storage");
  await enqueueSession(session);
  await refreshPending();
  void flush();
}

/**
 * Send whatever is queued. Safe to call at any time: it no-ops when offline,
 * when nothing is queued, or when a flush is already running.
 */
export async function flush(): Promise<void> {
  if (syncing) return;

  const prefs = await readPrefs();
  const device = prefs.device;
  if (!device) return;

  const sessions = await queuedSessions();
  if (sessions.length === 0) {
    emit({ pending: 0 });
    return;
  }

  syncing = true;
  emit({ syncing: true });

  try {
    const batch = sessions.slice(0, BATCH_LIMIT);
    // One uuid per batch, created once and reused until the batch lands.
    batchUuid ??= crypto.randomUUID();

    // Report what this device will still hold once the batch lands, not the
    // queue including it. Reporting sessions.length left the server believing
    // a phone that had sent everything still held its last batch, until its
    // next ruleset check (found in the Phase 8 browser run, BUILD-LOG 9a). If
    // the upload fails, the next request reports the true number again.
    const result = await deviceApi.sync(device.token, batchUuid, batch, sessions.length - batch.length);

    await dequeueSessions(batch.map((s) => s.client_session_uuid));
    batchUuid = null;
    const lastSyncAt = new Date().toISOString();
    await writePrefs({ lastSyncAt });
    emit({ lastSyncAt });
    await refreshPending();

    // More waiting than one batch holds: keep going.
    if (sessions.length > batch.length) {
      syncing = false;
      emit({ syncing: false });
      return flush();
    }

    void result;
  } catch (error) {
    const status = (error as { status?: number }).status;

    if (status === 422) {
      // The server will never accept this batch — a client bug or content it
      // does not know. Drop the batch uuid so the next attempt starts a new
      // batch, and leave the sessions queued for a person to look at rather
      // than retrying the same rejection forever.
      batchUuid = null;
      console.warn("Sync rejected a batch; leaving it queued for inspection.", error);
    } else if (!(error instanceof OfflineError)) {
      console.warn("Sync failed; will retry.", error);
    }
  } finally {
    syncing = false;
    emit({ syncing: false });
  }
}

/**
 * UT-013: check for a newer published ruleset and cache it.
 *
 * A failure keeps the cached bundle: triaging against yesterday's published
 * rules is correct behaviour offline, and every session records the version it
 * used, so the server can still reconstruct the result exactly (ADR-0007).
 */
/**
 * Why a device has no rules to triage with.
 *
 * These are worth telling apart, because the patient can act on one of them
 * and not on the others: "move to where there is signal" fixes `offline`,
 * and nothing the patient does fixes `unpublished` — that one is waiting on
 * the health office to publish a ruleset. Reporting a 503 as "no internet"
 * sends someone up a hill for nothing.
 */
export type BundleBlocker = "offline" | "unpublished" | "server";

export class BundleUnavailable extends Error {
  constructor(readonly reason: BundleBlocker) {
    super(reason);
    this.name = "BundleUnavailable";
  }
}

function classify(error: unknown): BundleBlocker {
  if (error instanceof OfflineError) return "offline";
  return (error as { status?: number }).status === 503 ? "unpublished" : "server";
}

export async function refreshBundle(force = false): Promise<CachedBundle | undefined> {
  const prefs = await readPrefs();
  const device = prefs.device;
  if (!device) return prefs.bundle;

  const cached = prefs.bundle;
  const age = cached ? Date.now() - new Date(cached.fetchedAt).getTime() : Infinity;
  if (!force && age < 6 * 60 * 60 * 1000) {
    return cached;
  }

  try {
    const pending = await queueLength();
    const bundle = await deviceApi.ruleset(device.token, pending);
    await writePrefs({ bundle });
    emit({ bundle });
    return bundle;
  } catch (error) {
    if (!(error instanceof OfflineError)) {
      console.warn("Could not refresh the ruleset; keeping the cached one.", error);
    }
    // A device that already holds a bundle keeps triaging: a failed refresh is
    // not the patient's problem. A device with nothing cached has no rules at
    // all, and the caller has to be able to say why.
    if (cached) return cached;
    throw new BundleUnavailable(classify(error));
  }
}

/** Facilities change rarely; refreshed opportunistically alongside the bundle. */
export async function refreshFacilities(): Promise<void> {
  const prefs = await readPrefs();
  if (!prefs.device) return;

  try {
    const facilities = await deviceApi.facilities(prefs.device.token);
    await writePrefs({ facilities });
  } catch {
    /* Offline: keep what we have. */
  }
}

/** Register this installation once, on the first connection (ADR-0005). */
export async function ensureRegistered(barangayId: number): Promise<DeviceCredential | undefined> {
  const prefs = await readPrefs();
  if (prefs.device) return prefs.device;

  const device = await deviceApi.register(barangayId);
  await writePrefs({ device });
  return device;
}

/**
 * Sync when the app opens and whenever the phone regains signal. There is no
 * timer: a patient's phone should not wake up to poll, and the queue drains on
 * the next real interaction anyway.
 */
export function startSync(): () => void {
  const onOnline = () => {
    void flush();
    // Background refresh: a device with no bundle yet will reject with
    // BundleUnavailable, which the onboarding screens report. Nothing to do
    // here but not crash on it.
    void refreshBundle().catch(() => undefined);
  };

  window.addEventListener("online", onOnline);
  void refreshPending().then(() => onOnline());

  return () => window.removeEventListener("online", onOnline);
}
