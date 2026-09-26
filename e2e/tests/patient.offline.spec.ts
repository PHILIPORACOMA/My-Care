import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { count } from "../support/env";
import { collectConsoleErrors, shot } from "../support/page";

/*
 * The patient journey the manuscript is built around, in a real browser:
 * onboard with signal, lose it, triage anyway, and have the results reach the
 * health office when signal comes back - once, not twice.
 *
 *   UT-001  barangay chosen from the cached list, stamped on every session
 *   UT-006  tier, advice and disclaimer render (English: the design's own copy)
 *   UT-012  de-identified records upload on reconnect
 *   UT-013  the published ruleset is downloaded and cached, then used offline
 *   UT-015  a retried upload is not double-counted
 *
 * Symptoms are entered by chip, not free text: v1 publishes no lexicon terms
 * yet, and inventing Cebuano or Tagalog vocabulary for a test is not allowed
 * (CLAUDE.md). The chip labels are v1's own display names.
 *
 * One page for the whole file, because the journey is stateful: the second
 * test needs the device the first one registered.
 */

test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;
let consoleErrors: string[];

test.beforeAll(async ({ browser }, testInfo) => {
  context = await browser.newContext(testInfo.project.use);
  page = await context.newPage();
  consoleErrors = collectConsoleErrors(page);
});

test.afterAll(async () => {
  await context.close();
});

async function triageByChip(chip: RegExp): Promise<void> {
  await page.getByRole("button", { name: /Check symptoms/ }).click();
  await page.getByRole("button", { name: chip }).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function checkAgain(): Promise<void> {
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByText("How are you feeling today?")).toBeVisible();
}

async function pendingInSettings(): Promise<string> {
  await page.getByRole("button", { name: "Settings" }).click();
  const line = page.getByText(/waiting to send|Everything has been sent/);
  await expect(line).toBeVisible();
  const text = (await line.textContent()) ?? "";
  await page.getByRole("button", { name: "Back" }).click();
  return text;
}

test("onboards with signal and caches the published rules (UT-001, UT-013)", async () => {
  const devicesBefore = count("devices");
  await page.goto("/");

  // Figure 17
  await expect(page.getByRole("button", { name: /Get started/ })).toBeVisible();
  await shot(page, "17-splash");
  await page.getByRole("button", { name: /Get started/ }).click();

  // Figure 18
  await page.getByRole("button", { name: /English/ }).click();
  await shot(page, "18-language");
  await page.getByRole("button", { name: "Continue" }).click();

  // Figure 19
  await expect(page.getByRole("button", { name: /Yes, I'm 18/ })).toBeVisible();
  await shot(page, "19-age-gate");
  await page.getByRole("button", { name: /Yes, I'm 18/ }).click();

  // Figure 20: the seeded Carcar list, from the server.
  await page.getByRole("button", { name: /Valladolid/ }).click();
  await shot(page, "20-barangay");
  await page.getByRole("button", { name: /Confirm barangay/ }).click();

  // Figure 21: rules downloaded, so the check is offered rather than a banner.
  await expect(page.getByText("How are you feeling today?")).toBeVisible();
  await expect(page.getByText(/Brgy\. Valladolid/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Check symptoms/ })).toBeVisible();
  await shot(page, "21-home");

  // The server now knows one more anonymous device, and nothing else about
  // it. (Other specs register devices too, so count from where we started.)
  expect(count("devices")).toBe(devicesBefore + 1);

  // The service worker must control the page before going offline means anything.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
});

test("triages all three tiers with no signal at all, and queues them (UT-006, UT-013)", async () => {
  await context.setOffline(true);

  // A hard reload with no network: the app itself must come from the device.
  await page.reload();
  await expect(page.getByText("How are you feeling today?")).toBeVisible();

  // Figure 22 then 25: home.
  await page.getByRole("button", { name: /Check symptoms/ }).click();
  await expect(page.getByRole("button", { name: /Fever, mild/ })).toBeVisible();
  await shot(page, "22-symptom-input");
  await page.getByRole("button", { name: /Fever, mild/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Can be managed at home.")).toBeVisible();
  await expect(page.getByText(/not a diagnosis/i).first()).toBeVisible();
  // The symptom is named as the patient chose it, never by its internal code.
  await expect(page.locator(".result-chip")).toHaveText("Fever, mild, <3 days, no red flags");
  await expect(page.getByText("fever_mild")).toHaveCount(0);
  await shot(page, "25-result-home");
  await checkAgain();

  // Figure 26: RHU.
  await triageByChip(/Fever persisting more than 3 days/);
  await expect(page.getByText("Go to the nearest Rural Health Unit.")).toBeVisible();
  await expect(page.getByText(/Show this screen to a health worker/)).toBeVisible();
  await shot(page, "26-result-rhu");
  await checkAgain();

  // Figure 27: emergency, with a number to call even with no facility loaded.
  await triageByChip(/Severe chest pain radiating/);
  await expect(page.getByText("Seek emergency help immediately.")).toBeVisible();
  await expect(page.locator(".result-chip")).toHaveText("Severe chest pain radiating to arm or jaw");
  await expect(page.getByRole("link", { name: /Call for help|911/ }).first()).toHaveAttribute("href", /^tel:/);
  await shot(page, "27-result-emergency");
  await checkAgain();

  // Nothing reached the server; all three wait on the device.
  expect(count("triage_sessions")).toBe(0);
  expect(await pendingInSettings()).toMatch(/3 finished checks waiting to send/);
  await page.getByRole("button", { name: "Settings" }).click();
  // "Start over" keeps clear of the card above it (it used to touch).
  const aboutBottom = await page.getByText("About My Care").locator("..").evaluate((el) => el.getBoundingClientRect().bottom);
  const startOverTop = await page.getByRole("button", { name: /Start over/ }).evaluate((el) => el.getBoundingClientRect().top);
  expect(startOverTop - aboutBottom).toBeGreaterThanOrEqual(12);
  await shot(page, "29-settings-offline");
  await page.getByRole("button", { name: "Back" }).click();
});

test("uploads on reconnect, and a retried upload is not double-counted (UT-012, UT-015)", async () => {
  // The worst case for UT-015: the server stores the batch, but the response
  // never reaches the phone - so the phone must retry, with the same batch id.
  let batchIds: string[] = [];
  let bodies: string[] = [];
  await context.route("**/api/v1/sync/batches", async (route) => {
    const body = route.request().postData() ?? "";
    bodies.push(body);
    batchIds.push(JSON.parse(body).client_batch_uuid);
    if (batchIds.length === 1) {
      await route.fetch(); // the server receives and stores it...
      await route.abort("connectionreset"); // ...the phone never hears back
    } else {
      await route.continue();
    }
  });

  await context.setOffline(false);

  await expect.poll(() => count("triage_sessions")).toBe(3);
  expect(count("sync_batches")).toBe(1);
  // From the phone's side the upload failed, so the checks are still queued.
  expect(await pendingInSettings()).toMatch(/3 finished checks waiting to send/);

  // Signal drops and comes back: the retry.
  await context.setOffline(true);
  await context.setOffline(false);

  await expect.poll(() => batchIds.length).toBeGreaterThanOrEqual(2);
  expect(batchIds[1]).toBe(batchIds[0]);
  await expect.poll(() => pendingInSettings()).toMatch(/Everything has been sent/);

  // Still three sessions and one batch: the replay was recognised, not re-counted.
  expect(count("triage_sessions")).toBe(3);
  expect(count("sync_batches")).toBe(1);

  // What left the phone: symptom codes and the barangay, stamped on each session.
  const sessions = JSON.parse(bodies[0]!).sessions as Record<string, unknown>[];
  expect(sessions).toHaveLength(3);
  expect(JSON.stringify(sessions)).toContain("fever_mild");
  expect(JSON.stringify(sessions)).toContain("chest_pain_severe_radiating");

  await context.unroute("**/api/v1/sync/batches");
});

test("logs no errors beyond the network ones going offline causes", async () => {
  expect(consoleErrors).toEqual([]);
});
