import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/{unit,integration}/**/*.test.{ts,tsx,mjs}"],
    environment: "node",
    restoreMocks: true,
  },
});
