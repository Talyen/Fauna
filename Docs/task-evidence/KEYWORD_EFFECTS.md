# Keyword effects implementation evidence

Local review on October 22, 2026, in the retained `task/keyword-effects` worktree. This record describes observed checks and their boundaries; hosted CI and release-device verification are separate.

## Implemented behavior

Alchemy-derived native WebGL plasma, Canvas 2D rising embers, masked CSS border shines and text shines share Fauna's keyword identities. No rendering dependency was added. Displayed rules and existing aliases supply palettes, Consume uses violet, and undiscovered creatures reveal no palette. Hover and intentional navigation focus override scoped selection/detail and screen baselines; opaque inspection owns the sole active backdrop. Existing target, selection, focus and gameplay owners remain separate.

Display includes independent device-local Background Glow and Background Particles controls. Reduced motion, zero intensity, backgrounding, resize, context failure/restoration and disposal are covered by the renderer/preference contracts. The production Mana sockets also now resolve prepared image URLs against the document URL instead of using dev-only paths or stylesheet-relative paths; the browser regression decodes the image before capture.

## Whole-screen review

All twelve combined scenarios completed the existing layout/error assertion at **1280×720 with 125% text** and **1920×1080 with default text**. Full frames were inspected for readable dark keyword text, border clipping, artwork ratios, layering and unchanged interaction geometry. Matching pre-feature captures exist for the original seven review scenarios; the five additional diagnostic scenarios were inspected in the final implementation. Layout captures use reduced motion, so moving backgrounds are assessed separately through normal-motion browser recordings.

Combined captures reflect implementation `4229b55` after incorporating main's startup work; battle and Death's Door were refreshed after the final Mana document-URL correction, with exact source hashes in their records. The following evidence paths are relative to the retained task checkout and are intentionally ignored generated reports:

| Scenario            | Capture record                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| battle              | `reports/review/final-mana-2c4a942b-bd6f-4b71-83d6-0202b6fc9355/evidence.json` |
| boon                | `reports/review/combined-8ec4e3e9-2f97-4c77-b2a6-363e9151f32a/evidence.json`   |
| campfire            | `reports/review/combined-f41494e8-489d-459e-b16e-39956e0b6367/evidence.json`   |
| collection-creature | `reports/review/combined-f0ba26d2-c23e-4351-b22f-8e86217a4146/evidence.json`   |
| death-door          | `reports/review/final-mana-d7e958c8-0276-49e1-9eaa-f4d5b7267a6a/evidence.json` |
| home                | `reports/review/combined-c6ed5066-f72a-4531-ae91-c44ad6ca2ad7/evidence.json`   |
| inspection          | `reports/review/combined-f7421b80-0808-4628-aa14-0a75305ab7ff/evidence.json`   |
| journey-results     | `reports/review/combined-a2d07fc9-dcb4-43b3-bf9a-f910a952ca7f/evidence.json`   |
| merchant            | `reports/review/combined-0e993fd0-fb3f-478d-a1a9-010d887774cf/evidence.json`   |
| recruit             | `reports/review/combined-cfe1c907-9371-470f-89b9-8b600a866ced/evidence.json`   |
| settings            | `reports/review/combined-48b020f3-3484-4707-acb9-f303be4976e4/evidence.json`   |
| talent-tree         | `reports/review/combined-d4bd6cef-6e3c-40bc-af51-56a6f12f1ed3/evidence.json`   |

The manifest at `reports/effects-browser-combined/rendered-review.json` lists all 24 frame paths. Before/final records remain under `reports/review/before-*` and `reports/review/final-*`. The required screenshots were inspected directly; passing geometry assertions alone was not treated as visual acceptance.

## Verification

- Focused unit/DOM gate before integration: 165 tests across 18 files passed, including palette/source ownership, renderer/context lifecycle, reduced motion, particle recycling, settings, inspection, navigation and targeting contracts
- Full static check passed: TypeScript projects, type-aware lint, formatting, boundaries/UI contracts and Knip; the final combined-source result is retained in `reports/effects-final-static.log`
- Production build, JavaScript allowance and active-media checks passed: **843,051 uncompressed JavaScript bytes** against **884,736**, and **167 active media files / 117.60 MiB** against 128 MiB; the allowance emits its existing 95% warning
- Browser: 28 distinct relevant tests passed across the broad run and focused effects rerun; one development-only combat skip requires a development preview and was not counted as a pass
- The first combined broad run retained one stale test-fixture typo already loaded by Playwright; the corrected inspection fixture subsequently passed. Strengthening the Mana regression exposed the stylesheet-relative asset error described above; its diagnostic trace remains in `reports/effects-browser-combined/mana-decode-diagnostic`. These failures were investigated rather than counted as passes
- Final normal-motion effects runs retain screenshots, videos, state-invariance assertions and performance attachments under `reports/effects-browser-combined/final-effects-run`. They cover battle hover, Death's Door, Collection, nested inspection, live reduced motion, zero/re-enabled controls and unavailable/lost/restored WebGL
- Mac native Electron 45.0.0, arm64: the existing menu journey/performance capture completed at 1280×800, DPR 2, normal motion. The combined-source sample recorded 451 frames, p50 **16.7 ms**, p95 **18.6 ms**, no frame gaps over 20 ms and zero long tasks. Report: `reports/performance/effects-native-combined/report.json`. This checks that menu journey, not a full native release smoke suite

A further native battle check on the final build decoded the prepared Mana artwork through Fauna's `fauna://app/` resource protocol, verified one active backdrop with two canvases and the hovered Block/Reflect palette, and captured `reports/effects-native-battle.png` for direct inspection. Result: `reports/effects-native-check.json`. The initial diagnostic harness incorrectly expected a file URL; it was corrected to the repository's existing protocol before acceptance.

The final diff was reviewed through `npm run review:diff`, including the complete stored patches and the final Mana URL correction. Protected integration uses `npm run integrate -- task/keyword-effects --test tests/unit/ui/inspection.test.tsx --test tests/unit/ui/menu-navigation.test.tsx`; its combined-source gate/output is retained in `reports/effects-integration.log`.

## Frame pacing observations

The focused Chromium comparison uses 120 requestAnimationFrame intervals per menu/battle condition at 1280×800, with normal motion and each background intensity set to 0% or 100%. The initial combined-source sample had p50 **16.7 ms** and p95 **16.8 ms** in all four conditions. Zero intensity left zero background canvases; full intensity ran two. Three conditions had no interval over 33.3 ms; full-intensity battle had one. Exact samples remain in `reports/effects-browser-combined/performance.json`; subsequent effects runs also attach their own samples.

These are short observations from one shared Mac, with Chromium's software WebGL path and a separate Electron menu sample. They do not measure GPU cost, battery use, steady-state device performance or establish a statistically meaningful speed difference. The plasma renderer retains Alchemy's 30 FPS and backing-pixel budgets; renderer cleanup/parking is covered separately by contract tests.

## Boundaries

Windows packaging, physical controller hardware, the real Steam client and Steam Deck were not exercised. Browser controller checks simulate input. Hosted CI was not run and no branch was pushed, published or released. The full native desktop smoke suite and native battle performance comparison were not run. Generated reports remain with the task worktree for follow-up.
