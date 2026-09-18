import type { SessionRecord } from "./db.js";

/**
 * No-op until apps/api exists (Phase 3). Wire this to POST de-identified
 * session records to the Laravel aggregation endpoint once it's built —
 * raw symptom text must never be included (README's privacy section).
 */
export async function syncSessions(_sessions: SessionRecord[]): Promise<void> {
  return;
}
