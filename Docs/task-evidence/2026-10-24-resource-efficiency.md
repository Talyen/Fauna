# Resource efficiency implementation evidence

Implementation commit: `c5aa5d1`; baseline: `01e59c4`. [Resource efficiency](../RESOURCE_EFFICIENCY.md) owns the maintained behavior, commands and budgets.

## Confirmed source and disk results

- Active media falls from 141,107,319 to 135,976,101 bytes: 4.89 MiB removed by excluding unused Marsh music, while preserving its original recording
- All 190 retained preparation records match the baseline exactly, including source/output hashes, dimensions, recipes and URLs; preparation reported 190 cache hits and zero encoded/copied selections
- Explicit pruning validated active outputs and removed 81 unreferenced historical objects totaling 76,033,130 bytes, including metadata and the retired Marsh output; originals and active objects survive
- Media aliases already shared files; the earlier 3.06 MiB duplicate estimate counted IDs twice and is not a saving
- The read-only historical evidence audit found 1,786 SHA-256 duplicate groups totaling 3,368,307,869 logical duplicate bytes, with zero unstable files; no historical evidence was deleted and APFS sharing prevents treating this as guaranteed reclaimable allocation
- Other worktrees remain intact because clean/merged status does not confirm inactivity; main's installed dependency metadata is incomplete, so existing private installations were not reattached

## Local checks and preview observations

The initial exact `tests/unit/tooling/resources.test.mjs` regression passed five cases covering unique-URL accounting, the installed packager's actual dependency filter, corrupt copied media, conservative pruning and dependency reattachment. A later evidence-audit regression and final affected suites remain CI-owned. Changed-file formatting, syntax lint, source contracts, documentation checks and diff review passed for the implementation.

Voluntary Vite/Chromium preview observations used fresh contexts, 1280×720, 125% text and reduced motion. Startup requested 168 artwork objects on baseline and 21 on the changed source. Home, Collection, creature inspection, Collection paging and battle frames had no settled layout violations. Inspection Escape returned focus to its opener. Baseline and changed battle row bounds matched: x 299.5, y 12.078125, width 681, height 229.25. Images were inspected at whole-screen scale without new composition, readability or artwork defects.

These are diagnostic preview observations, not an accepted complete browser journey or native performance result. The first layout sample preceded ResizeObserver settling; the canonical polled layout check passed on both sources. Additional harness attempts exposed duplicate Playwright installations across checkouts and an incorrect targeting assumption; neither establishes a game defect. The harness was corrected to use each checkout's own tools and production `cardTargeting`, but its final extra cancellation/save comparison could not start because the shared host lane was occupied. The reports retain those incomplete attempts rather than relabeling them successful.

The implementation changes optional preparation work and tooling, preserving essential-art/font/splash readiness, media bytes, geometry and input contracts. It falls under the behavior-preserving source/tooling row in [required UI review](../UI.md#required-review); no visual redesign or interaction-contract change is being accepted from failed captures.

## Remaining verification and maintenance

Hosted CI must run the final compiler/unit/browser/Windows package gates. The performance workflow now records native startup/battle observations and three repeated Collection/inspection/paging/Talents cycles. Build maximum RSS and package size inventories are retained separately. No measured runtime RAM reduction, packaged-size reduction beyond selected media, native FPS gain, Windows startup result, physical controller result, Steam client result or Steam Deck result is claimed here.

Task-owned ignored reports under `reports/resources/` retain pruning records, exact historical duplicate groups and retained-copy mappings, source review identity, preview frames and the corrected focused driver. Revalidate identities and retained copies before any separately approved historical deletion. Do not retire other worktrees or alter their dependencies without confirming inactivity.
