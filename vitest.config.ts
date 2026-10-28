import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { runtimeCatalogPlugin } from "./scripts/localization/runtime-catalogs.mjs";
export default defineConfig({
  plugins: [runtimeCatalogPlugin()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    testTimeout: process.env.CI ? 0 : 5000,
    hookTimeout: process.env.CI ? 0 : 10000,
    include: ["tests/{unit,integration,exhaustive}/**/*.test.{ts,tsx,mjs}"],
    environment: "node",
    restoreMocks: true,
  },
});
