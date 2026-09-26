import { expect, test } from "@playwright/test";
import { STAFF, URLS, artisan } from "../support/env";
import { collectConsoleErrors, settled, shot } from "../support/page";

/*
 * The sub-admin portal (Figures 30-35), signed in as a Valladolid sub-admin,
 * reading what the patient journey synced a moment ago.
 *
 *   UT-014  sync status shows the last sync and device/session counts
 *   UT-016  the account sees its own barangay only
 *   UT-020  a count under 5 renders as <5 - the journey synced exactly 3
 */

const base = URLS.portal;

test.beforeAll(() => {
  // Scheduled every 10 minutes in production; run once so the dashboards have
  // the patient journey's sessions in them.
  artisan("mycare:aggregate");
});

test("a sub-admin signs in and every screen renders (UT-014, UT-016, UT-020)", async ({ page }) => {
  const errors = collectConsoleErrors(page);

  // Figure 30
  await page.goto(`${base}/`);
  await page.getByLabel("Email").fill(STAFF.sub.email);
  await page.getByLabel("Password").fill(STAFF.sub.password);
  await shot(page, "30-portal-login");
  await page.getByRole("button", { name: "Log in" }).click();

  // Figure 31: the dashboard, scoped to the account's barangay.
  await expect(page.getByRole("heading", { name: /Valladolid/ }).first()).toBeVisible();
  await expect(page.getByText("<5").first()).toBeVisible();
  await shot(page, "31-portal-dashboard");

  const screens: [string, RegExp, string][] = [
    ["Trends & surveillance", /Trends & surveillance/, "32-portal-trends"],
    ["Sync & status", /Sync & status/, "33-portal-sync"],
    ["Data & reports", /Data & reports/, "34-portal-reports"],
    ["Aggregate map", /Aggregate map/, "35-portal-map"],
  ];

  for (const [link, heading, name] of screens) {
    await page.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    if (link === "Sync & status") {
      // UT-014: the sync just happened, so the data is current, not "never".
      await expect(page.getByText("Data is current")).toBeVisible();
    }
    await settled(page);
    await shot(page, name);
  }

  // UT-016: nothing about any other barangay reaches this account.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText(/Guadalupe|Can-asujan/)).toHaveCount(0);

  expect(errors).toEqual([]);
});
