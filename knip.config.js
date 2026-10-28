/** Runtime and tool entrypoints are explicit so native adapters and SSR harnesses remain visible. */
export default {
  playwright: { config: ["playwright*.config.ts"] },
  entry: [
    "src/ui/styles.css", // Tailwind is consumed through stylesheet imports, not JavaScript.
    "src/ui/startup/splash.css", // The HTML shell loads this before JavaScript starts.
    "desktop/preload.cjs",
    "desktop/after-pack.cjs",
    "desktop/steam-worker.cjs",
    "scripts/*.mjs",
    "scripts/{agent,assets,balance,checks,ci,dev,performance,release}/*.mjs",
    "src/tooling/{playthrough,balance,performance}.ts",
    "design/**/*.tsx",
  ],
  project: [
    "src/**/*.{ts,tsx,css}",
    "desktop/**/*.cjs",
    "scripts/**/*.mjs",
    "design/**/*.{ts,tsx}",
    "tests/**/*.{ts,tsx,mjs}",
  ],
  // Named modifier owners have local runtime callers and typed data-only references.
  tags: ["-modifierContract"],
  ignore: ["src/components/ui/**"], // Registered upstream primitive public props are intentionally retained.
  // The regression verifies the matcher shipped inside our pinned electron-builder installation.
  ignoreDependencies: ["app-builder-lib"],
  ignoreBinaries: ["du"], // System disk-allocation utility, not an npm binary.
};
