import { defineConfig } from "@playwright/test";
const ci = process.env["CI"] !== undefined;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: ci ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: ci ? [["line"], ["html", { open: "never" }]] : "list",
  webServer: {
    command: "node tests/e2e/mock-server.mjs",
    url: "http://127.0.0.1:4173/health",
    reuseExistingServer: !ci,
  },
  use: {
    browserName: "firefox",
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
