import { expect, test } from "@playwright/test";
import { scalar } from "../support/env";
import { collectConsoleErrors, shot } from "../support/page";

/*
 * "Change barangay" in Settings (Figure 29): the patient moves, and so does
 * the device's registration, so the sub-admin's Sync & status (Figure 33,
 * UT-014) counts the phone where it now reports. With no signal the move
 * waits, and happens by itself when signal returns. The phone never registers
 * a second time.
 *
 * Creates no sessions, so the specs that count sessions are unaffected.
 */

const barangayId = (name: string) => scalar(`App\\Models\\Barangay::where('name', '${name}')->value('id')`);
const deviceBarangay = (id: number) => scalar(`App\\Models\\Device::whereKey(${id})->value('barangay_id')`);

test("the device moves with the patient, online and after an offline change (UT-014)", async ({ browser }, testInfo) => {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  const errors = collectConsoleErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: /Get started/ }).click();
  await page.getByRole("button", { name: /English/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Yes, I'm 18/ }).click();
  await page.getByRole("button", { name: /Valladolid/ }).click();
  await page.getByRole("button", { name: /Confirm barangay/ }).click();
  await expect(page.getByText(/Brgy\. Valladolid/)).toBeVisible();

  const device = scalar("App\\Models\\Device::max('id')");
  const devicesBefore = scalar("App\\Models\\Device::count()");
  expect(deviceBarangay(device)).toBe(barangayId("Valladolid"));

  async function changeTo(name: string): Promise<void> {
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Change barangay" }).click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: /Confirm barangay/ }).click();
    await expect(page.getByText(new RegExp(`Brgy\\. ${name}`))).toBeVisible();
  }

  // With signal: the server hears at once.
  await changeTo("Bolinawan");
  await expect.poll(() => deviceBarangay(device)).toBe(barangayId("Bolinawan"));
  await shot(page, "29b-changed-barangay");

  // With no signal: the phone moves now, the server when signal returns.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await changeTo("Tuyom");
  expect(deviceBarangay(device)).toBe(barangayId("Bolinawan"));

  await context.setOffline(false);
  await expect.poll(() => deviceBarangay(device)).toBe(barangayId("Tuyom"));

  // Moved twice, registered once.
  expect(scalar("App\\Models\\Device::count()")).toBe(devicesBefore);
  expect(errors).toEqual([]);
  await context.close();
});
