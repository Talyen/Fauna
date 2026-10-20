/** Runtime and tool entrypoints are explicit so native adapters and SSR harnesses remain visible. */
export default {
  entry: [
    "src/main.tsx",
    "desktop/main.cjs",
    "desktop/preload.cjs",
    "desktop/after-pack.cjs",
    "desktop/steam-worker.cjs",
    "scripts/*.mjs",
    "src/application/{playthrough,balance,performance}.ts",
    "design/**/*.tsx",
  ],
  project: [
    "src/**/*.{ts,tsx}",
    "desktop/**/*.cjs",
    "scripts/**/*.mjs",
    "design/**/*.{ts,tsx}",
    "tests/**/*.{ts,tsx,mjs}",
  ],
  ignore: ["src/components/ui/**"], // Registered upstream primitive public props are intentionally retained.
};
