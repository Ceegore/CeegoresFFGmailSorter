// Mock-Gmail E2E (spec §60.4). Serves the synthetic SPA at the gmail host via
// request interception so the analyzer's hostname guard sees mail.google.com,
// injects the built content script, opens the overlay via the test bridge,
// and drives the workflow against the mock's simulated Gmail behavior.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const CONTENT_JS = resolve(import.meta.dirname, "..", "..", "dist", "content.js");
async function setupMockPage(page) {
  // Intercept https://mail.google.com/* and serve the mock SPA, so the page's
  // real location.hostname is mail.google.com (the analyzer requires this).
  const mockHtml = readFileSync(resolve(import.meta.dirname, "mock-gmail.html"), "utf8");
  await page.route("https://mail.google.com/**", (route) => {
    void route.fulfill({ status: 200, contentType: "text/html", body: mockHtml });
  });
  await page.goto("https://mail.google.com/mail/u/0/#inbox", { waitUntil: "load" });
  const source = readFileSync(CONTENT_JS, "utf8");
  await page.addScriptTag({ content: source });
  await page.waitForFunction(() => {
    const w = window;
    return typeof w.__gisoShowOverlay === "function";
  });
}
test.describe("Mock Gmail workflow", () => {
  test("overlay opens, shows brand credit, analyzes, and finds groups", async ({ page }) => {
    await setupMockPage(page);
    await page.evaluate(() => {
      window.__gisoShowOverlay();
    });
    const credit = page.locator('[data-testid="brand-credit"]');
    await expect(credit).toHaveText("made by Ceegore", { timeout: 5000 });
    await page.locator('[data-testid="giso-analyze"]').click();
    await expect(page.getByText("Analyse abgeschlossen")).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="giso-group"]')).toHaveCount(2);
  });
  test("no external network request is made (spec E2E-017)", async ({ page }) => {
    const external = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      // mail.google.com requests are intercepted locally; anything else is external.
      if (url.hostname !== "mail.google.com" && url.hostname !== "127.0.0.1") {
        external.push(request.url());
      }
    });
    await setupMockPage(page);
    await page.evaluate(() => {
      window.__gisoShowOverlay();
    });
    await page.locator('[data-testid="giso-analyze"]').click();
    await expect(page.getByText("Analyse abgeschlossen")).toBeVisible({ timeout: 8000 });
    expect(external).toEqual([]);
  });
});
