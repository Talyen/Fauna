import { defineConfig } from "vitest/config";
import { runtimeCatalogPlugin } from "./scripts/localization/runtime-catalogs.mjs";

export default defineConfig({
  plugins: [runtimeCatalogPlugin()],
  test: {
    include: [
      "tests/integration/gameplay/mana.test.ts",
      "tests/unit/application/session.test.ts",
      "tests/unit/tooling/verification.test.mjs",
    ],
    environment: "node",
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    restoreMocks: true,
    testTimeout: 5000,
    hookTimeout: 5000,
  },
});
