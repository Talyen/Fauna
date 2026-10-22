/** Runtime and tool entrypoints are explicit so native adapters and SSR harnesses remain visible. */
export default {
  entry: [
    "src/ui/styles.css", // Tailwind is consumed through stylesheet imports, not JavaScript.
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
  ignore: ["src/components/ui/**"], // Registered upstream primitive public props are intentionally retained.
};
