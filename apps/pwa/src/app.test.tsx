// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The whole patient journey, Figures 17-27, driven the way a patient drives it.
 *
 * The API is stubbed; everything else is real — the lexicon matcher, the triage
 * engine, IndexedDB (fake-indexeddb), the queue and the outgoing payload.
 */

const bundle = {
  versionLabel: "v9",
  symptomCodes: [
    { code: "code_cold", displayName: "Fixture cold", needsClarification: false },
    { code: "code_fever", displayName: "Fixture fever", needsClarification: true },
  ],
  lexiconTerms: [
    { symptomCode: "code_cold", language: "ceb", term: "sipon", isNegation: false },
    { symptomCode: "code_fever", language: "ceb", term: "hilanat", isNegation: false },
  ],
  severityThresholds: [],
  clarificationQuestions: [
    {
      questionKey: "fever_severity",
      symptomCode: "code_fever",
      language: "ceb",
      prompt: "Unsa ka grabe ang imong gibati?",
      answerType: "single_select",
      allowedAnswers: ["gamay", "grabe"],
      redFlagAnswer: "grabe",
    },
  ],
  rules: [
    {
      code: "R-002",
      name: "fever",
      expression: "IF code_fever THEN rhu",
      conditions: [{ symptomCode: "code_fever", operator: "AND" }],
      outcomeTier: "rhu",
      priority: 1,
      isActive: true,
    },
  ],
  healthTips: [],
};

let posted: { url: string; body: Record<string, unknown> }[] = [];

function stubApi() {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const path = String(url);
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (init.method === "POST" || init.method === "PATCH") posted.push({ url: path, body });

    if (path.endsWith("/api/v1/barangays")) {
      return new Response(
        JSON.stringify({
          barangays: [
            { id: 1, name: "Valladolid", city: "Carcar City" },
            { id: 2, name: "Bolinawan", city: "Carcar City" },
          ],
        }),
        { status: 200 }
      );
    }
    if (path.endsWith("/api/v1/devices/current")) {
      return new Response(JSON.stringify({ device: { id: 3, barangayId: body.barangay_id } }), { status: 200 });
    }
    if (path.endsWith("/api/v1/devices")) {
      return new Response(JSON.stringify({ token: "prefix.secret", device: { id: 3 } }), { status: 201 });
    }
    if (path.endsWith("/api/v1/ruleset/current")) {
      return new Response(JSON.stringify({ versionLabel: "v9", publishedAt: null, bundle }), { status: 200 });
    }
    if (path.endsWith("/api/v1/facilities")) {
      return new Response(JSON.stringify({ facilities: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({ client_batch_uuid: "b", status: "complete", stored_session_uuids: [], duplicate: false }), { status: 200 });
  });
}

beforeEach(async () => {
  posted = [];
  stubApi();
  vi.resetModules();
  const storage = await import("./storage");
  await storage.clearEverything();
});

afterEach(() => vi.unstubAllGlobals());

async function launch() {
  const { App } = await import("./App");
  render(<App />);
  return userEvent.setup();
}

describe("a patient checking their symptoms", () => {
  it("walks onboarding, triages on the device and queues a de-identified record", async () => {
    const user = await launch();

    // Figure 17: one button in, no login.
    await user.click(await screen.findByRole("button", { name: /Get started/ }));

    // Figure 18: language first, so everything after is in it.
    await user.click(await screen.findByRole("button", { name: /Cebuano/ }));
    // Found, not got: the Cebuano copy appears once the choice is saved.
    await user.click(await screen.findByRole("button", { name: /Padayon/ }));

    // Figure 19: the adult-only checkpoint.
    expect(await screen.findByText(/18 anyos o mas magulang/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Oo, 18/ }));

    // Figure 20: barangay, no GPS.
    await user.click(await screen.findByRole("button", { name: /Valladolid/ }));
    await user.click(screen.getByRole("button", { name: /Kumpirmaha ang barangay/ }));

    // Figure 21: home, greeting the barangay rather than a person.
    expect(await screen.findByText(/Kumusta imong pamati karon\?/)).toBeInTheDocument();
    expect(screen.getByText(/Brgy\. Valladolid/)).toBeInTheDocument();

    // Figure 22: free text, matched against the published lexicon on-device.
    await user.click(screen.getByRole("button", { name: /Susiha ang sintomas/ }));
    await user.type(await screen.findByRole("textbox"), "naa koy hilanat");
    await user.click(screen.getByRole("button", { name: "Padayon" }));

    // Figure 23: the clarification the symptom's code asks for.
    expect(await screen.findByText("Unsa ka grabe ang imong gibati?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "gamay" }));

    // Figure 24 then Figure 26: processing, then the amber RHU result.
    expect(await screen.findByText(/Gisusi ang imong mga sintomas/)).toBeInTheDocument();
    expect(await screen.findByText(/Adto sa pinakaduol nga Rural Health Unit/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/Ipakita kini nga screen sa health worker/)).toBeInTheDocument();

    // What was queued: codes and the server's own vocabulary, never the words.
    await waitFor(() => expect(posted.some((p) => p.url.includes("/sync/batches"))).toBe(true));
    const batch = posted.find((p) => p.url.includes("/sync/batches"))!;
    const sessions = batch.body.sessions as Record<string, unknown>[];
    const json = JSON.stringify(batch.body);

    expect(sessions).toHaveLength(1);
    expect(json).not.toContain("naa koy hilanat");
    expect(sessions[0]!.matched_rule_code).toBe("R-002");
    expect(sessions[0]!.language).toBe("ceb");
    expect(JSON.stringify(sessions[0]!.symptoms)).toContain("code_fever");
  }, 20000);

  it("escalates to emergency on a red-flag answer, whatever language it was given in", async () => {
    const user = await launch();

    await user.click(await screen.findByRole("button", { name: /Get started/ }));
    await user.click(await screen.findByRole("button", { name: /Cebuano/ }));
    // Found, not got: the Cebuano copy appears once the choice is saved.
    await user.click(await screen.findByRole("button", { name: /Padayon/ }));
    await user.click(screen.getByRole("button", { name: /Oo, 18/ }));
    await user.click(await screen.findByRole("button", { name: /Valladolid/ }));
    await user.click(screen.getByRole("button", { name: /Kumpirmaha ang barangay/ }));

    await user.click(await screen.findByRole("button", { name: /Susiha ang sintomas/ }));
    // Tapping the chip rather than typing: the same structured output.
    await user.click(await screen.findByRole("button", { name: /hilanat/ }));
    await user.click(screen.getByRole("button", { name: "Padayon" }));

    await user.click(await screen.findByRole("button", { name: "grabe" }));

    expect(await screen.findByText(/Pangayo dayon ug emergency nga tabang/, {}, { timeout: 4000 })).toBeInTheDocument();
    // Figure 27's "Call for help" falls back to 911 with no facility loaded.
    expect(screen.getByRole("link", { name: /911/ })).toHaveAttribute("href", "tel:911");
  }, 20000);

  it("still triages with no signal, and queues the result for later", async () => {
    const user = await launch();

    // Onboard while connected, since the first run must download the rules.
    await user.click(await screen.findByRole("button", { name: /Get started/ }));
    await user.click(await screen.findByRole("button", { name: /English/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: /Yes, I'm 18/ }));
    await user.click(await screen.findByRole("button", { name: /Valladolid/ }));
    await user.click(screen.getByRole("button", { name: /Confirm barangay/ }));
    expect(await screen.findByText(/How are you feeling today\?/)).toBeInTheDocument();

    // Now the phone loses signal entirely.
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });

    await user.click(screen.getByRole("button", { name: /Check symptoms/ }));
    await user.click(await screen.findByRole("button", { name: /Fixture fever/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "gamay" }));

    // The tier still comes out — the engine and lexicon are on the device.
    expect(await screen.findByText(/Go to the nearest Rural Health Unit/, {}, { timeout: 4000 })).toBeInTheDocument();

    // And the record is waiting rather than lost.
    const storage = await import("./storage");
    await waitFor(async () => expect(await storage.queueLength()).toBe(1));
  }, 20000);

  /*
   * The language pill (every screen after onboarding). Switching mid-check
   * changes the copy and nothing else: what was typed stays typed, and the
   * session is recorded in the language the check finished in.
   */
  it("switches language mid-check from the pill without losing what was typed", async () => {
    const startedAt = new Date().toISOString();
    const user = await launch();
    await user.click(await screen.findByRole("button", { name: /Get started/ }));
    await user.click(await screen.findByRole("button", { name: /English/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: /Yes, I'm 18/ }));
    await user.click(await screen.findByRole("button", { name: /Valladolid/ }));
    await user.click(screen.getByRole("button", { name: /Confirm barangay/ }));

    await user.click(await screen.findByRole("button", { name: /Check symptoms/ }));
    await user.type(await screen.findByRole("textbox"), "naa koy hilanat");

    // Closed until tapped; Escape closes it again without changing anything.
    const pill = screen.getByRole("button", { name: "Language: English" });
    expect(pill).toHaveAttribute("aria-expanded", "false");
    await user.click(pill);
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Language" })).not.toBeInTheDocument();

    await user.click(pill);
    await user.click(screen.getByRole("button", { name: "Cebuano (Bisaya)" }));

    // Same screen, now in Cebuano, the text untouched.
    expect(await screen.findByRole("heading", { name: "Unsa imong gibati?" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("naa koy hilanat");
    expect(screen.getByRole("button", { name: "Pinulongan: Cebuano" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Padayon" }));
    await user.click(await screen.findByRole("button", { name: "gamay" }));
    expect(await screen.findByText(/Adto sa pinakaduol nga Rural Health Unit/, {}, { timeout: 4000 })).toBeInTheDocument();

    // The result screen has the pill too: back to English, same result.
    await user.click(screen.getByRole("button", { name: "Pinulongan: Cebuano" }));
    await user.click(screen.getByRole("button", { name: /^English/ }));
    expect(await screen.findByText(/Go to the nearest Rural Health Unit/)).toBeInTheDocument();

    // Recorded in the language the check finished in. Only this test's own
    // session counts: the previous test can still be uploading its English
    // one through the shared fake IndexedDB when this one starts.
    const mine = () =>
      posted
        .filter((p) => p.url.includes("/sync/batches"))
        .flatMap((p) => p.body.sessions as Record<string, unknown>[])
        .filter((s) => String(s.started_at) >= startedAt);
    await waitFor(() => expect(mine()).toHaveLength(1));
    expect(mine()[0]!.language).toBe("ceb");
  }, 20000);

  /*
   * A 503 means the server answered and has no published ruleset. Telling the
   * patient "you need an internet connection" would be a lie they can act on,
   * badly: there is no signal to go and find, and the fix belongs to the
   * health office. This is the bug Philipo hit while testing on 2026-09-23.
   */
  it("says the rules are unpublished, not that the phone is offline, on a 503", async () => {
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      const path = String(url);
      if (path.endsWith("/api/v1/barangays")) {
        return new Response(JSON.stringify({ barangays: [{ id: 1, name: "Valladolid", city: "Carcar City" }] }), { status: 200 });
      }
      if (path.endsWith("/api/v1/devices")) {
        return new Response(JSON.stringify({ token: "prefix.secret", device: { id: 3 } }), { status: 201 });
      }
      if (path.endsWith("/api/v1/ruleset/current")) {
        return new Response(JSON.stringify({ message: "No published ruleset version is available." }), { status: 503 });
      }
      if (path.endsWith("/api/v1/facilities")) {
        return new Response(JSON.stringify({ facilities: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    const user = await launch();
    await user.click(await screen.findByRole("button", { name: /Get started/ }));
    await user.click(await screen.findByRole("button", { name: /English/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: /Yes, I'm 18/ }));
    await user.click(await screen.findByRole("button", { name: /Valladolid/ }));
    await user.click(screen.getByRole("button", { name: /Confirm barangay/ }));

    expect(await screen.findByText(/no triage rules have been published/)).toBeInTheDocument();
    expect(screen.queryByText(/needs an internet connection/)).not.toBeInTheDocument();
  }, 20000);
});

/*
 * UT-001 with no signal at all. The barangay list ships inside the app (names
 * only - barangays.ts), so a phone that has never been online can still
 * choose. The server's id is resolved by name at first contact, which also
 * registers the device and downloads the rules; nothing is triaged before it.
 */
describe("choosing a barangay before the phone has ever had signal", () => {
  async function onboardOffline(user: Awaited<ReturnType<typeof launch>>, barangay: RegExp) {
    await user.click(await screen.findByRole("button", { name: /Get started/ }));
    await user.click(await screen.findByRole("button", { name: /English/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: /Yes, I'm 18/ }));
    // The shipped list, with no server behind it.
    await user.click(await screen.findByRole("button", { name: barangay }));
    await user.click(screen.getByRole("button", { name: /Confirm barangay/ }));
  }

  it("offers the shipped list offline, then finishes setup by itself when signal returns", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    const user = await launch();

    await onboardOffline(user, /Valladolid/);

    // Home, honest about what is missing; the choice is saved without an id.
    expect(await screen.findByText(/needs an internet connection/)).toBeInTheDocument();
    const storage = await import("./storage");
    const offline = await storage.readPrefs();
    expect(offline.barangay).toMatchObject({ name: "Valladolid", id: null });
    expect(offline.device).toBeUndefined();

    // Signal comes back.
    stubApi();
    window.dispatchEvent(new Event("online"));

    // The device registered under the SERVER's id for Valladolid, and has rules.
    expect(await screen.findByRole("button", { name: /Check symptoms/ }, { timeout: 5000 })).toBeInTheDocument();
    const registration = posted.find((p) => p.url.endsWith("/api/v1/devices"));
    expect(registration?.body.barangay_id).toBe(1);
    expect((await storage.readPrefs()).barangay).toMatchObject({ name: "Valladolid", id: 1 });
  }, 20000);

  it("asks again, rather than guessing, when the server no longer has the chosen barangay", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    const user = await launch();

    // Tuyom is on the shipped list; the stub server below knows only Valladolid.
    await onboardOffline(user, /Tuyom/);
    expect(await screen.findByText(/needs an internet connection/)).toBeInTheDocument();

    stubApi();
    window.dispatchEvent(new Event("online"));

    expect(await screen.findByText(/no longer has the barangay you chose/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(posted.some((p) => p.url.endsWith("/api/v1/devices"))).toBe(false);
    const storage = await import("./storage");
    expect((await storage.readPrefs()).barangay).toBeUndefined();

    // The server's own list is offered now.
    expect(screen.getByRole("button", { name: /Valladolid/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tuyom/ })).not.toBeInTheDocument();
  }, 20000);
});

/*
 * "Change barangay" in Settings (Figure 29, PR #8). The device's registration
 * moves with the patient, so Sync & status (UT-014) counts the phone where it
 * now reports. Checks recorded before the move keep their own barangay.
 */
describe("changing barangay from Settings", () => {
  async function onboardInValladolid(user: Awaited<ReturnType<typeof launch>>) {
    await user.click(await screen.findByRole("button", { name: /Get started/ }));
    await user.click(await screen.findByRole("button", { name: /English/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: /Yes, I'm 18/ }));
    await user.click(await screen.findByRole("button", { name: /Valladolid/ }));
    await user.click(screen.getByRole("button", { name: /Confirm barangay/ }));
    expect(await screen.findByText(/Brgy. Valladolid/)).toBeInTheDocument();
  }

  async function changeTo(user: Awaited<ReturnType<typeof launch>>, barangay: RegExp) {
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(await screen.findByRole("button", { name: "Change barangay" }));
    await user.click(await screen.findByRole("button", { name: barangay }));
    await user.click(screen.getByRole("button", { name: /Confirm barangay/ }));
  }

  const moves = () => posted.filter((p) => p.url.endsWith("/api/v1/devices/current"));

  it("moves the device with the patient, without registering it again", async () => {
    const user = await launch();
    await onboardInValladolid(user);
    const registrations = posted.filter((p) => p.url.endsWith("/api/v1/devices")).length;

    await changeTo(user, /Bolinawan/);

    expect(await screen.findByText(/Brgy. Bolinawan/)).toBeInTheDocument();
    await waitFor(() => expect(moves()).toHaveLength(1));
    expect(moves()[0]!.body).toEqual({ barangay_id: 2 });
    expect(posted.filter((p) => p.url.endsWith("/api/v1/devices")).length).toBe(registrations);

    const storage = await import("./storage");
    expect((await storage.readPrefs()).device?.barangayId).toBe(2);
  }, 20000);

  it("with no signal, keeps triaging under the new barangay and moves the device on reconnect", async () => {
    const user = await launch();
    await onboardInValladolid(user);

    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    await changeTo(user, /Bolinawan/);
    expect(await screen.findByText(/Brgy. Bolinawan/)).toBeInTheDocument();

    const storage = await import("./storage");
    expect((await storage.readPrefs()).device?.barangayId).toBe(1);

    // A check done offline is recorded under the barangay the patient chose.
    await user.click(screen.getByRole("button", { name: /Check symptoms/ }));
    await user.click(await screen.findByRole("button", { name: /Fixture fever/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "gamay" }));
    expect(await screen.findByText(/Go to the nearest Rural Health Unit/, {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(async () => expect((await storage.queuedSessions())[0]?.barangay_id).toBe(2));

    // Signal returns: the device moves, once.
    stubApi();
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(moves()).toHaveLength(1));
    expect(moves()[0]!.body).toEqual({ barangay_id: 2 });
    await waitFor(async () => expect((await storage.readPrefs()).device?.barangayId).toBe(2));
  }, 20000);
});
