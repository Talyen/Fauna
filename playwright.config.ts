import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:48210",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 48210 --strictPort",
    url: "http://127.0.0.1:48210",
    reuseExistingServer: !process.env.CI,
  },
  reporter: [["list"], ["json", { outputFile: "reports/playwright.json" }]],
});
