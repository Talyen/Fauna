import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/{unit,integration,exhaustive}/**/*.test.{ts,tsx,mjs}"],
    environment: "node",
    restoreMocks: true,
  },
});
