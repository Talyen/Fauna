import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/mana.test.ts", "tests/unit/session.test.ts", "tests/unit/verification.test.mjs"],
    environment: "node",
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    restoreMocks: true,
    testTimeout: 5000,
    hookTimeout: 5000,
  },
});
