# Disk and memory efficiency

Preserve artwork pixels, audio bytes, command behavior and save ordering. Optimize duplicate storage and resource lifetimes before considering new media formats or smaller artwork. [Contributing](../CONTRIBUTING.md#execution-and-evidence) owns local execution limits; builds, native performance and packaging remain CI-owned.

## Inventory and budgets

Run `npm run resources -- --out reports/resources/inventory.json` to record source identity, unique active media bytes and existing renderer/package sizes without building. `--local` additionally audits registered worktrees, dependency compatibility and archived task storage. Reports distinguish logical file sizes from `du` allocation; APFS shared extents mean allocated totals are not a guaranteed reclamation estimate. Inventory never deletes or installs anything and refuses to overwrite an existing report.

`--evidence` optionally streams SHA-256 checks over same-size bulk files in retired task archives and main's reports. It proposes exact duplicate groups with one retained copy, file sizes and modification identities. It preserves small summaries and bundles marked `.retention-keep`, skips unstable files and performs no deletion. A deletion review must recheck both retained and duplicate copies and establish inactivity; a hash inventory alone does not authorize a purge.

Count unique media URLs, not asset IDs. Use the generated inventory for current totals; the [inventory history](task-evidence/2026-10-24-resource-efficiency.md#inventory-history) retains earlier counts, byte totals and corrections. [Build media validation](../scripts/assets/active-assets.mjs) owns the active-media allowance and per-image ceiling. The [bundle allowance](../scripts/checks/bundle-budget.mjs) remains separate. CI retains a renderer/package inventory and Linux build maximum-RSS observations under `reports/resources/`. GNU time's maximum RSS is the observed command/child high-water mark, not a sum of every process's simultaneous RAM.

`nominalRgbaBytes` is image dimensions multiplied by four; it is not resident memory, VRAM or a promised optimization saving. Establish game-memory budgets from repeated matching-runtime captures, retaining process identity, conditions and cold/warm status. Never add process working sets into a purported unique-memory total because shared allocations can be counted repeatedly.

## Build and package lifetimes

[Asset preparation](../scripts/assets/assets.mjs) preflights source hashes, then reads one source at a time and rejects a source changed between those passes. Complete output validation and atomic publication remain required. Unchanged objects retain their bytes and encoder receipts.

[Build media](../scripts/assets/active-assets.mjs) copies files individually outside bundler asset buffers, validates copied hashes, rechecks selection identity and writes the media receipt after copying. [Package verification](../scripts/release/verify-package.mjs) compares renderer files lazily instead of retaining the entire renderer in a buffer map. Corruption and source-change checks remain intact.

Windows packaging excludes renderer npm modules already compiled into Vite output. Only Steamworks, Koffi and its target-platform native dependency remain as desktop node modules. Package verification rejects unexpected dependency files. Renderer dependencies remain production build inputs for license/SBOM coverage; they are not moved to development dependencies to hide them from packaging.

## Artwork preparation

[Startup](../src/ui/startup/prepare.ts) waits for current-screen essentials, fonts and the existing splash duration. Optional preparation chooses at most eight owned/offered ability images beyond current-screen artwork. It never resolves a future command or selects candidates from hidden draw order. Selection changes, backgrounding and disposal cancel obsolete preparation; no permanent image-element cache retains the library. Browser-managed decoded-image eviction remains outside application control.

Verify first-use battle, Collection, inspection and paging with uncached browser contexts. Missing images, degraded artwork, command delays or navigation regressions fail acceptance. The [UI review procedure](UI.md#required-review) defines rendered evidence.

The weekly/manual [performance workflow](../.github/workflows/performance.yml) includes native Windows startup, battle and menu observations. `npm run perf -- --electron --scenario resource-menus` repeats Collection, inspection, paging and Talents three times without changing gameplay checkpoints; this longer case is opt-in and does not widen ordinary captures. Captures record per-process working-set and peak-working-set values in KiB at readiness and action boundaries, plus Windows private bytes where available. GPU-process host RAM is not dedicated GPU memory. Browser heap, unpackaged Electron, Windows packaging, physical controls and Steam Deck remain separate verification scopes.

For a comparison, supply a full `memory_baseline` commit to the manual workflow. The native job captures three baseline/treatment pairs on one Windows runner with matching capture instrumentation and fixtures. Only capture tooling is overlaid in the baseline checkout; its production sources remain unchanged. Retain the overlay manifest and compare matching process types and action labels across trials; report medians and ranges without adding shared process working sets together. A single ordinary capture establishes observations, not a measured saving.

## Explicit maintenance

- `npm run assets:prune` plans removal of obsolete prepared objects after validating active outputs and checking source references; `-- --apply` removes only that exact eligible set under asset-preparation admission. Originals, active objects, referenced historical objects, symlinks and unexpected files survive. Retired tracked bytes remain recoverable from Git; this does not rewrite history
- `npm run deps -- --share` explicitly reconnects the caller's registered task checkout to main's matching, healthy install. Failed compatibility checks preserve private dependencies; installation never runs through a shared link. Close that task's tools before changing its dependency directory
- Use [worktree cleanup](../scripts/README.md#worktree-operations) only after confirming a merged clean checkout is inactive. Clean/merged status alone is insufficient. Do not infer inactivity from age, remove ambiguous worktrees or alter another active task's dependencies
- Keep source/commit summaries, unique screenshots, failed or incomplete investigations and deliberate full replay bundles. Compress/deduplicate reproducible bulk evidence only after verifying retained copies. Prepare an exact manifest and obtain separate approval before permanently deleting historical evidence; quarantine and relocation alone do not reclaim space

Smaller image variants, lossy audio/image conversion, Git-history rewriting and package-manager migration are separate experiments. Consider them only after the byte-preserving changes are measured and reviewed.
