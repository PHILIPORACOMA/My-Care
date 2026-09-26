import { expect, test } from "@playwright/test";
import { artisan, count } from "../support/env";
import { collectConsoleErrors, shot } from "../support/page";

/*
 * UT-001 on a phone that loses signal before it is set up: the app was opened
 * once (so the service worker installed it), then onboarding happens with no
 * signal at all. The barangay list ships inside the app, so the patient can
 * still choose; the server's barangay id is resolved by name when signal
 * returns, and only then does the device register.
 */

test("chooses a barangay with no signal, and finishes setup when signal returns (UT-001)", async ({ browser }, testInfo) => {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  const errors = collectConsoleErrors(page);
  const devicesBefore = count("devices");

  // Opened once with signal: the service worker installs the app shell.
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Get started/ })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  // Then no signal, before onboarding.
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /Get started/ }).click();
  await page.getByRole("button", { name: /English/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Yes, I'm 18/ }).click();

  // The shipped list: all 15, with no server reachable.
  await expect(page.getByRole("button", { name: /Valladolid/ })).toBeVisible();
  await expect(page.locator(".list .choice")).toHaveCount(15);
  // Nothing to warn about yet: choosing works offline. What is still missing
  // is explained on Home, after the patient confirms.
  await expect(page.getByText(/needs an internet connection/)).toHaveCount(0);
  await shot(page, "20b-barangay-offline");
  await page.getByRole("button", { name: /Valladolid/ }).click();
  await page.getByRole("button", { name: /Confirm barangay/ }).click();

  await expect(page.getByText(/needs an internet connection/)).toBeVisible();
  expect(count("devices")).toBe(devicesBefore);

  // Signal returns: setup finishes by itself.
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: /Check symptoms/ })).toBeVisible({ timeout: 15_000 });
  expect(count("devices")).toBe(devicesBefore + 1);

  // Registered under the server's own id for Valladolid - not a guessed one.
  const registered = artisan(
    "tinker",
    "--execute=echo DB::table('devices')->orderByDesc('id')->value('barangay_id') == DB::table('barangays')->where('name','Valladolid')->value('id') ? 'match' : 'mismatch';"
  );
  expect(registered.trim().split(/\r?\n/).pop()).toBe("match");

  expect(errors).toEqual([]);
  await context.close();
});
