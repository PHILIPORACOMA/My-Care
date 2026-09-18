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
    if (init.method === "POST") posted.push({ url: path, body });

    if (path.endsWith("/api/v1/barangays")) {
      return new Response(JSON.stringify({ barangays: [{ id: 1, name: "Valladolid", city: "Carcar City" }] }), { status: 200 });
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
    await user.click(screen.getByRole("button", { name: /Padayon/ }));

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
    await user.click(screen.getByRole("button", { name: /Padayon/ }));
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
});
