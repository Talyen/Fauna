import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  workers: 1,
  // A broken shared layout otherwise repeats the same failure across every viewport.
  // Green runs still execute the complete suite.
  maxFailures: process.env.CI ? 5 : undefined,
  timeout: process.env.CI ? 0 : 90000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    actionTimeout: 5000,
    baseURL: process.env.FAUNA_TEST_URL ?? "http://127.0.0.1:48210",
    viewport: { width: 1280, height: 800 },
    trace: { mode: "retain-on-failure", screenshots: false },
    screenshot: "only-on-failure",
  },
  webServer: process.env.FAUNA_TEST_URL
    ? undefined
    : {
        command: "npm run preview -- --port 48210 --strictPort",
        url: "http://127.0.0.1:48210",
        reuseExistingServer: !process.env.CI,
      },
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "reports/playwright.json" }], ["blob"]]
    : [["list"], ["json", { outputFile: "reports/playwright.json" }]],
});
