import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { releaseIdentityPlugin } from "./scripts/lib/release-identity.mjs";
import { activeAssetsPlugin } from "./scripts/assets/active-assets.mjs";
import { runtimeCatalogPlugin } from "./scripts/localization/runtime-catalogs.mjs";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
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
    runtimeCatalogPlugin(),
    {
      name: "development-connect-policy",
      transformIndexHtml: (html) =>
        command === "serve"
          ? html.replace("connect-src 'none'", "connect-src 'self' ws://127.0.0.1:*")
          : html,
    },
    activeAssetsPlugin(),
    {
      name: "startup-shell",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          const prepared = JSON.parse(
            readFileSync(new URL("./src/assets/prepared.json", import.meta.url), "utf8"),
          );
          return html
            .replace(
              "data-startup-preferences",
              `src="./${command === "build" ? "assets/" : ""}startup-preferences.js"`,
            )
            .replace(
              /data-startup-leaf="(green|gold)"/g,
              (_match, color) => `src="${prepared.records[`loading.leaf-${color}`].url}"`,
            );
        },
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "assets/startup-preferences.js",
          source: readFileSync(new URL("./public/startup-preferences.js", import.meta.url)),
        });
      },
    },
    react(),
    // Keep an uncompiled build available for the paired performance workflow.
    ...(process.env.FAUNA_REACT_COMPILER !== "0" ? [babel({ presets: [reactCompilerPreset()] })] : []),
    tailwind(),
    releaseIdentityPlugin(fileURLToPath(new URL(".", import.meta.url))),
  ],
  server: { port: 48209, strictPort: true },
  // Fauna's supported Chromium already implements modulepreload; keep the startup entry lean.
  // The bundle gate measures emitted bytes; gzip reporting only adds console diagnostics.
  build: { target: "es2022", modulePreload: { polyfill: false }, reportCompressedSize: false },
}));
