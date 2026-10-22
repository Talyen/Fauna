import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { releaseIdentityPlugin } from "./scripts/lib/release-identity.mjs";
import { activeAssetsPlugin } from "./scripts/assets/active-assets.mjs";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig(({ command }) => ({
  publicDir: command === "build" ? false : "public",
  base: "./",
  define: {
    __FAUNA_BUILD__: JSON.stringify(
      execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(),
    ),
    __FAUNA_QUIET_PREVIEW__: "false",
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    activeAssetsPlugin(),
    react(),
    tailwind(),
    releaseIdentityPlugin(fileURLToPath(new URL(".", import.meta.url))),
  ],
  server: { port: 48209, strictPort: true },
  build: { target: "es2022" },
}));
