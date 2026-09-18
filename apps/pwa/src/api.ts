import type { RulesetBundle } from "@mycare/ruleset";
import type { Barangay, CachedBundle, DeviceCredential, Facility, QueuedSession } from "./storage";

/**
 * The device half of the API (ADR-0003, ADR-0005).
 *
 * A device is not an account: it holds a token issued at registration and
 * sends it as a bearer credential. Patients have no login and nothing here
 * identifies a person.
 *
 * Every call can fail because the phone is out of signal, which is normal
 * rather than exceptional — callers treat a rejection as "try again later",
 * never as a reason to lose a session.
 */

const PENDING_HEADER = "X-Pending-Sessions";

export class OfflineError extends Error {
  constructor() {
    super("offline");
    this.name = "OfflineError";
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string, pending?: number): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body) headers["Content-Type"] = "application/json";
  // Figures 33 and 40 show how many sessions are still waiting on devices;
  // the server has no other way to know (ADR-0005).
  if (pending !== undefined) headers[PENDING_HEADER] = String(pending);

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new OfflineError();
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      message = ((await response.json()) as { message?: string }).message ?? message;
    } catch {
      /* not JSON */
    }
    const error = new Error(message) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return (await response.json()) as T;
}

export const deviceApi = {
  /** Public: the onboarding barangay list (Figure 20). */
  barangays: () => request<{ barangays: Barangay[] }>("/api/v1/barangays").then((r) => r.barangays),

  /** Anonymous self-registration: barangay and device class only (ADR-0005). */
  register: (barangayId: number) =>
    request<{ token: string; device: { id: number } }>("/api/v1/devices", {
      method: "POST",
      body: JSON.stringify({ barangay_id: barangayId, type: "patient_phone" }),
    }).then((r): DeviceCredential => ({ id: r.device.id, token: r.token, barangayId })),

  /** UT-013: the current published bundle, cached on the device. */
  ruleset: (token: string, pending: number) =>
    request<{ versionLabel: string; publishedAt: string | null; bundle: RulesetBundle }>(
      "/api/v1/ruleset/current",
      {},
      token,
      pending
    ).then(
      (r): CachedBundle => ({
        versionLabel: r.versionLabel,
        publishedAt: r.publishedAt,
        fetchedAt: new Date().toISOString(),
        bundle: r.bundle,
      })
    ),

  /** Emergency contacts for "Call for help" (Figure 27). */
  facilities: (token: string) =>
    request<{ facilities: Facility[] }>("/api/v1/facilities", {}, token).then((r) => r.facilities),

  /**
   * UT-012, UT-015: upload a batch. The batch uuid is generated before the
   * first attempt and reused on every retry, so a lost acknowledgement cannot
   * double-count (the server answers a replay with the original result).
   */
  sync: (token: string, batchUuid: string, sessions: QueuedSession[], pending: number) =>
    request<{ client_batch_uuid: string; status: string; stored_session_uuids: string[]; duplicate: boolean }>(
      "/api/v1/sync/batches",
      {
        method: "POST",
        body: JSON.stringify({
          client_batch_uuid: batchUuid,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          sessions,
        }),
      },
      token,
      pending
    ),
};
