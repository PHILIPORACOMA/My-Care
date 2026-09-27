import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { DEPLOYED_URL, REPO_ROOT, STAFF, URLS, artisan, count, scalar } from "../support/env";
import { collectConsoleErrors, settled, shot } from "../support/page";

/*
 * Free-text triage, end to end: a lexicon published from the console reaches
 * a phone, and the patient's own words - in Cebuano, Tagalog and English -
 * become a tier with no signal at all.
 *
 *   UT-011  a super-admin publishes a version, with the clinical attestation
 *   UT-013  a phone downloads the published version, lexicon included
 *   UT-002  free text in Tagalog or Cebuano is accepted and matched
 *   UT-003  "sip-on" matches despite the spelling variation
 *   UT-004  "walay hilanat" excludes fever instead of flagging it
 *   UT-005  the matched symptoms reach the rule engine and give v1's tier
 *
 * THE LEXICON IS THE INVENTED TEST FIXTURE (packages/ruleset/src/testing/
 * lexicon-fixture.ts), not reviewed vocabulary, and it is published only
 * inside the throwaway mycare_e2e schema. v1 itself still has no terms. The
 * publish below is a test step, not a clinical-review attestation.
 *
 * It runs last (its own Playwright project, after "staff"), because
 * publishing a new version retires v1 and adds sessions, which the patient
 * and staff specs count from a known state.
 */

test.describe.configure({ mode: "serial" });
test.skip(!!DEPLOYED_URL, "Imports a local bundle file; the deploy smoke test checks the deployment, not the lexicon.");

const bundlePath = path.join(REPO_ROOT, "packages/ruleset/dist/v1-test-lexicon.json");

let patient: BrowserContext;
let page: Page;
let consoleErrors: string[];

test.beforeAll(async ({ browser }, testInfo) => {
  patient = await browser.newContext(testInfo.project.use);
  page = await patient.newPage();
  consoleErrors = collectConsoleErrors(page);
});

test.afterAll(async () => {
  await patient.close();
});

test("a super-admin publishes the test lexicon from the console (UT-011)", async ({ browser }) => {
  // Imported the way a real bundle is: as a draft, which reaches no phone.
  const out = artisan("mycare:ruleset:import", bundlePath);
  const label = /Imported as draft (v\d+)/.exec(out)?.[1];
  expect(label, out).toBeDefined();

  const staff = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const admin = await staff.newPage();
  const errors = collectConsoleErrors(admin);

  await admin.goto(`${URLS.console}/`);
  await admin.getByLabel("Email").fill(STAFF.super.email);
  await admin.getByLabel("Password").fill(STAFF.super.password);
  await admin.getByRole("button", { name: /Log in|Sign in/ }).click();
  await expect(admin.getByRole("heading", { name: "System dashboard" })).toBeVisible();

  await admin.getByRole("link", { name: "Rules & lexicon" }).click();
  await settled(admin);
  await admin.getByRole("link", { name: label!, exact: true }).click();
  await settled(admin);

  // The terms arrived intact.
  await admin.getByRole("tab", { name: /Lexicon/ }).click();
  await expect(admin.getByRole("tab", { name: "Lexicon (124)" })).toBeVisible();
  await shot(admin, "39c-console-test-lexicon");

  await admin.getByRole("button", { name: "Submit for clinical review" }).click();
  await admin.getByRole("button", { name: "Publish to devices" }).click();
  const dialog = admin.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Publish" })).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(admin.getByText(`${label} is published.`, { exact: false })).toBeVisible();

  expect(errors).toEqual([]);
  await staff.close();
});

test("a phone downloads it and triages free text with no signal (UT-013, UT-002 to UT-005)", async () => {
  await page.goto("/");
  await page.getByRole("button", { name: /Get started/ }).click();
  await page.getByRole("button", { name: /English/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Yes, I'm 18/ }).click();
  await page.getByRole("button", { name: /Valladolid/ }).click();
  await page.getByRole("button", { name: /Confirm barangay/ }).click();
  await expect(page.getByRole("button", { name: /Check symptoms/ })).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await patient.setOffline(true);
  await page.reload();
  await expect(page.getByText("How are you feeling today?")).toBeVisible();

  const box = () => page.getByRole("textbox");
  const matched = () => page.locator(".matches");
  const cont = () => page.getByRole("button", { name: "Continue" });

  async function type(text: string): Promise<void> {
    await page.getByRole("button", { name: /Check symptoms/ }).click();
    await box().fill(text);
  }
  async function checkAgain(): Promise<void> {
    await page.getByRole("button", { name: "Check again" }).click();
    await expect(page.getByText("How are you feeling today?")).toBeVisible();
  }

  // Cebuano, home.
  await type("hilanat");
  await expect(matched()).toHaveText("✓ hilanat");
  await shot(page, "22b-symptom-input-free-text");
  await cont().click();
  await expect(page.getByText("Can be managed at home.")).toBeVisible();
  await checkAgain();

  // UT-004: a negation alone is not a symptom, so there is nothing to check.
  await type("walay hilanat");
  await expect(matched()).toHaveText("✕ walay hilanat");
  await expect(cont()).toBeDisabled();
  // ...and next to a real symptom it excludes only its own.
  await box().fill("sakit sa ulo, walay hilanat");
  await expect(matched()).toContainText("✓ sakit sa ulo");
  await expect(matched()).toContainText("✕ walay hilanat");
  await page.getByRole("button", { name: "Back" }).click();

  // UT-003: the spelling variation.
  await type("sip on");
  await expect(matched()).toContainText(/✓ sip-?on/);
  await page.getByRole("button", { name: "Back" }).click();

  // Cebuano, a longer phrase over the word inside it: RHU.
  await type("dugay na hilanat");
  await expect(matched()).toHaveText("✓ dugay na hilanat");
  await cont().click();
  await expect(page.getByText("Go to the nearest Rural Health Unit.")).toBeVisible();
  await checkAgain();

  // Tagalog, emergency.
  await type("hirap huminga");
  await expect(matched()).toHaveText("✓ hirap huminga");
  await cont().click();
  await expect(page.getByText("Seek emergency help immediately.")).toBeVisible();
  await shot(page, "27b-result-emergency-free-text");
  await checkAgain();
});

test("the free-text sessions upload with the lexicon entry that matched", async () => {
  const sessionsBefore = count("triage_sessions");
  const version = scalar("App\\Models\\RulesetVersion::where('status', 'published')->value('id')");

  await patient.setOffline(false);

  await expect.poll(() => count("triage_sessions"), { timeout: 30_000 }).toBe(sessionsBefore + 3);
  // Recorded against the version that was published, and each symptom points
  // at the server's own lexicon entry - never the patient's words.
  expect(scalar(`DB::table('triage_sessions')->where('ruleset_version_id', ${version})->count()`)).toBe(3);
  expect(
    scalar(
      `DB::table('session_symptoms')->join('triage_sessions', 'triage_sessions.id', '=', 'session_symptoms.triage_session_id')` +
        `->where('triage_sessions.ruleset_version_id', ${version})->whereNotNull('matched_term_id')->count()`
    )
  ).toBe(3);
});

test("logs no errors beyond the network ones going offline causes", async () => {
  expect(consoleErrors).toEqual([]);
});
