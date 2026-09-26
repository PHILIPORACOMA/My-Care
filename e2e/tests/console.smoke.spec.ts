import { expect, test } from "@playwright/test";
import { STAFF, URLS } from "../support/env";
import { collectConsoleErrors, settled, shot } from "../support/page";

/*
 * The super-admin console (Figures 36-41): signed in as the development team,
 * every screen opens and shows the state the run built - v1 published, one
 * device, the sub-admin account.
 */

const base = URLS.console;

test("a super-admin signs in and every screen renders", async ({ page }) => {
  const errors = collectConsoleErrors(page);

  // Figure 36
  await page.goto(`${base}/`);
  await page.getByLabel("Email").fill(STAFF.super.email);
  await page.getByLabel("Password").fill(STAFF.super.password);
  await shot(page, "36-console-login");
  await page.getByRole("button", { name: /Log in|Sign in/ }).click();

  // Figure 37
  await expect(page.getByRole("heading", { name: "System dashboard" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await shot(page, "37-console-dashboard");

  const screens: [string, RegExp, string, RegExp?][] = [
    ["User management", /User management/, "38-console-users", new RegExp(STAFF.sub.email)],
    ["Rules & lexicon", /Triage rules & lexicon/, "39-console-rules", /v1/],
    ["Symptom codes", /Symptom codes/, "39b-console-symptom-codes", /fever_mild/],
    // The phone sent everything, so it must not be shown as still holding any.
    ["Sync & system health", /Sync & system health/, "40-console-sync-health", /^none$/],
    ["Audit log", /Audit log/, "41-console-audit"],
  ];

  for (const [link, heading, name, content] of screens) {
    await page.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    if (content) await expect(page.getByText(content).first()).toBeVisible();
    await settled(page);
    await shot(page, name);
  }

  expect(errors).toEqual([]);
});
