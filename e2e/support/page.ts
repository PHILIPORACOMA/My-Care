import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { REPO_ROOT } from "./env";

/**
 * Screenshots land in e2e/screenshots/ (gitignored), named for the manuscript
 * figure they correspond to, so a run doubles as a set of figures to compare
 * against the design.
 */
export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(REPO_ROOT, "e2e/screenshots", `${name}.png`), fullPage: true });
}

/**
 * Collect console errors and uncaught exceptions. The browser logs a failed
 * request as a console error by itself; those are expected whenever a test
 * takes the network away (or aborts a request on purpose), so they are
 * excluded. Anything else is a real defect.
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  const expected = /Failed to load resource|net::ERR_(INTERNET_DISCONNECTED|FAILED|CONNECTION_RESET|NETWORK_CHANGED)|Failed to fetch/;

  page.on("console", (message) => {
    if (message.type() === "error" && !expected.test(message.text())) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`uncaught: ${error.message}`));

  return errors;
}

/**
 * Wait until a staff screen has finished loading: the network is quiet and no
 * `Async` spinner from @mycare/ui is left. A screen that never gets there is a
 * defect, and the test fails on it rather than screenshotting a spinner.
 */
export async function settled(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 20_000 });
}
