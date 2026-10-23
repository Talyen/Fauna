import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

export default defineConfig(config, {
  testDir: "tests/performance",
  outputDir: "reports/performance/effects-results",
  reporter: [["list"], ["json", { outputFile: "reports/performance/effects.json" }]],
});
