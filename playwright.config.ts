import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  // A broken shared layout otherwise repeats the same failure across every viewport.
  // Green runs still execute the complete suite.
  maxFailures: process.env.CI ? 5 : undefined,
  timeout: 90000,
  use: {
    baseURL: process.env.FAUNA_TEST_URL ?? "http://127.0.0.1:48210",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: process.env.FAUNA_TEST_URL
    ? undefined
    : {
        command: "npm run preview -- --port 48210 --strictPort",
        url: "http://127.0.0.1:48210",
        reuseExistingServer: !process.env.CI,
      },
  reporter: [["list"], ["json", { outputFile: "reports/playwright.json" }]],
});
