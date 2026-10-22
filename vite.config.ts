import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { releaseIdentityPlugin } from "./scripts/lib/release-identity.mjs";
import { activeAssetsPlugin } from "./scripts/assets/active-assets.mjs";
import react from "@vitejs/plugin-react";
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
    {
      name: "development-connect-policy",
      transformIndexHtml: (html) =>
        command === "serve"
          ? html.replace("connect-src 'none'", "connect-src 'self' ws://127.0.0.1:*")
          : html,
    },
    activeAssetsPlugin(),
    react(),
    // Compiler adoption is measured by the paired performance workflow before becoming the default.
    ...(process.env.FAUNA_REACT_COMPILER === "1"
      ? [babel({ plugins: ["babel-plugin-react-compiler"] })]
      : []),
    tailwind(),
    releaseIdentityPlugin(fileURLToPath(new URL(".", import.meta.url))),
  ],
  server: { port: 48209, strictPort: true },
  build: { target: "es2022" },
}));
