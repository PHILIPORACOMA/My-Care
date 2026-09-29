import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueuedSession } from "./storage";

/*
 * The offline sync layer (UT-012, UT-015).
 *
 * Runs against fake-indexeddb, so the queue is a real IndexedDB, and a stubbed
 * fetch, so the network can be made to fail exactly when the field would fail.
 */

const session = (uuid: string): QueuedSession => ({
  client_session_uuid: uuid,
  barangay_id: 1,
  ruleset_version_label: "v9",
  matched_rule_code: "R-001",
  language: "ceb",
  started_at: "2026-09-18T01:00:00.000Z",
  completed_at: "2026-09-18T01:01:00.000Z",
  symptoms: [{ symptom_code: "code_cold", negated: false, matched_term: null }],
  clarification_answers: [],
});

interface Call {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

let calls: Call[] = [];
let respond: (call: Call) => Response | Promise<Response>;

async function freshModules() {
  vi.resetModules();
  const storage = await import("./storage");
  await storage.clearEverything();
  await storage.writePrefs({ device: { id: 7, token: "prefix.secret", barangayId: 1 } });
  const sync = await import("./sync");
  return { storage, sync };
}

beforeEach(() => {
  calls = [];
  respond = () => new Response(JSON.stringify({ client_batch_uuid: "x", status: "complete", stored_session_uuids: [], duplicate: false }), { status: 200 });

  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      url: String(url),
      body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
      headers: (init.headers ?? {}) as Record<string, string>,
    };
    calls.push(call);
    return respond(call);
  });

  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "11111111-2222-3333-4444-555555555555" });
});

afterEach(() => vi.unstubAllGlobals());

describe("queueing a finished check", () => {
  it("stores it before uploading, then clears it once the server accepts", async () => {
    const { storage, sync } = await freshModules();

    await sync.recordSession(session("a1"));
    await sync.flush();

    expect(calls.some((c) => c.url.includes("/sync/batches"))).toBe(true);
    expect(await storage.queueLength()).toBe(0);
  });

  /* A phone out of signal is normal. Nothing may be lost. */
  it("keeps the check queued when the upload fails", async () => {
    const { storage, sync } = await freshModules();
    respond = () => {
      throw new TypeError("network down");
    };

    await sync.recordSession(session("a1"));
    await sync.flush();

    expect(await storage.queueLength()).toBe(1);
  });

  /*
   * UT-015. A device cannot tell "my upload was lost" from "my acknowledgement
   * was lost", so a retry must carry the SAME batch uuid — the server answers a
   * replay with the original result instead of counting it twice.
   */
  it("reuses the batch uuid when retrying after a failure", async () => {
    const { sync } = await freshModules();

    respond = () => {
      throw new TypeError("network down");
    };
    await sync.recordSession(session("a1"));
    await sync.flush();

    respond = () => new Response(JSON.stringify({ client_batch_uuid: "x", status: "complete", stored_session_uuids: ["a1"], duplicate: true }), { status: 200 });
    await sync.flush();

    const batches = calls.filter((c) => c.url.includes("/sync/batches"));
    expect(batches.length).toBeGreaterThanOrEqual(2);
    expect(new Set(batches.map((c) => c.body.client_batch_uuid)).size).toBe(1);
  });

  it("leaves a rejected batch queued rather than retrying it forever", async () => {
    const { storage, sync } = await freshModules();
    respond = () => new Response(JSON.stringify({ message: "Unknown symptom code." }), { status: 422 });

    await sync.recordSession(session("a1"));
    await sync.flush();

    expect(await storage.queueLength()).toBe(1);
  });

  /*
   * Figures 33 and 40 show the queue still sitting on devices. An upload
   * reports what will be left once it lands: the batch that empties the
   * queue must report 0, or the dashboards count sessions the server
   * already has as still waiting on the phone.
   */
  it("reports how many sessions will still be waiting, in a header", async () => {
    const { storage, sync } = await freshModules();
    await sync.recordSession(session("a1"));
    await sync.recordSession(session("a2"));
    await sync.flush();

    const batches = calls.filter((c) => c.url.includes("/sync/batches"));
    expect(batches.length).toBeGreaterThan(0);
    expect(batches.every((b) => b.headers["X-Pending-Sessions"] !== undefined)).toBe(true);
    expect(await storage.queueLength()).toBe(0);
    expect(batches.at(-1)?.headers["X-Pending-Sessions"]).toBe("0");
  });
});

describe("the cached ruleset", () => {
  it("keeps the cached bundle when the server cannot be reached (UT-013)", async () => {
    const { storage, sync } = await freshModules();
    const cached = {
      versionLabel: "v9",
      publishedAt: null,
      fetchedAt: "2020-01-01T00:00:00.000Z",
      bundle: { versionLabel: "v9", symptomCodes: [], lexiconTerms: [], severityThresholds: [], clarificationQuestions: [], rules: [], healthTips: [] },
    };
    await storage.writePrefs({ bundle: cached });

    respond = () => {
      throw new TypeError("network down");
    };

    const result = await sync.refreshBundle(true);

    expect(result?.versionLabel).toBe("v9");
    expect((await storage.readPrefs()).bundle?.versionLabel).toBe("v9");
  });

  it("caches a newer bundle when one is available", async () => {
    const { storage, sync } = await freshModules();
    respond = () =>
      new Response(
        JSON.stringify({
          versionLabel: "v10",
          publishedAt: "2026-09-18T00:00:00+00:00",
          bundle: { versionLabel: "v10", symptomCodes: [], lexiconTerms: [], severityThresholds: [], clarificationQuestions: [], rules: [], healthTips: [] },
        }),
        { status: 200 }
      );

    await sync.refreshBundle(true);

    expect((await storage.readPrefs()).bundle?.versionLabel).toBe("v10");
  });
});

/*
 * Changing barangay in Settings (PR #8) moves the device's registration too,
 * so Sync & status (UT-014) counts the phone where it now reports.
 */
describe("the device's barangay", () => {
  it("moves the registration when the patient has changed barangay", async () => {
    const { storage, sync } = await freshModules();
    respond = () => new Response(JSON.stringify({ device: { id: 7, barangayId: 2 } }), { status: 200 });

    const device = await sync.ensureRegistered(2);

    const move = calls.find((c) => c.url.endsWith("/api/v1/devices/current"));
    expect(move?.body).toEqual({ barangay_id: 2 });
    expect(move?.headers.Authorization).toBe("Bearer prefix.secret");
    expect(device).toEqual({ id: 7, token: "prefix.secret", barangayId: 2 });
    expect((await storage.readPrefs()).device?.barangayId).toBe(2);
  });

  it("calls nothing when the device is already where the patient is", async () => {
    const { sync } = await freshModules();
    await sync.ensureRegistered(1);
    expect(calls).toHaveLength(0);
  });

  it("keeps the old registration, to retry later, when there is no signal", async () => {
    const { storage, sync } = await freshModules();
    respond = () => {
      throw new TypeError("offline");
    };

    await expect(sync.ensureRegistered(2)).rejects.toThrow();
    expect((await storage.readPrefs()).device?.barangayId).toBe(1);
  });

  it("counts setup as unfinished until the server knows where the phone is", async () => {
    const { sync } = await freshModules();
    const device = { id: 7, token: "t", barangayId: 1 };
    const at = (id: number | null) => ({ name: "X", city: "Carcar City", id });

    expect(sync.setupPending({})).toBe(false);
    expect(sync.setupPending({ barangay: at(1) })).toBe(true); // not registered
    expect(sync.setupPending({ barangay: at(null), device })).toBe(true); // picked offline, no id yet
    expect(sync.setupPending({ barangay: at(2), device })).toBe(true); // moved, server not told
    expect(sync.setupPending({ barangay: at(1), device })).toBe(false);
  });
});

describe("start over", () => {
  it("clears preferences and anything still queued (Figure 29)", async () => {
    const { storage, sync } = await freshModules();
    await sync.recordSession(session("a1"));

    await storage.clearEverything();

    expect(await storage.queueLength()).toBe(0);
    expect(await storage.readPrefs()).toEqual({});
  });
});
