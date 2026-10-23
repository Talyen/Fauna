# Frame pacing investigation — October 22, 2026

This pass removes avoidable browser work without changing artwork, resolution, effects,
animation curves, durations, sound or command admission. It does not establish that every
screen is free of hitches on every supported device.

## Changes

| Owner                                  | Cause                                                                                                                     | Change                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/ui/infrastructure/surface-ref.ts` | Each mounted control read offsets and immediately wrote its corner variable, forcing style/layout work between siblings   | Use the initial ResizeObserver border box before paint; retain synchronous measurement where ResizeObserver is unavailable |
| `src/ui/battle/hand-motion.tsx`        | Card flights read destination geometry between overlay writes; draw setup also read its source after appending each clone | Read the draw source once and all live destinations before frame writes; continue tracking fan motion every frame          |
| `src/ui/battle/hand-motion.tsx`        | Every flight frame assigned the current image source again                                                                | Change the source only when the card face changes                                                                          |
| `src/ui/shared/cards/swap-motion.ts`   | Each portrait read CSS tokens after writing its position                                                                  | Read duration and arc tokens before moving either portrait                                                                 |
| `src/ui/battle/battle-screen.tsx`      | An unchanged selected-card forecast reran authoritative combat resolution on unrelated renders                            | Memoize by immutable game snapshot, selected card and target                                                               |

The geometry change is shared by buttons, artwork and other measured surfaces across the app.
The animation changes preserve live endpoints, sequencing, flips, arcs, interruptions and
reduced-motion behavior. Gameplay, persistence, asset quality and CSS remain unchanged.

## Evidence

All paths below are relative to the retained task checkout's ignored
`reports/frame-pacing/` directory. Production builds, fresh isolated profiles, one local
measurement process at a time, a 2 GiB Node heap limit and five-minute command deadlines
were used. Unrelated running applications were preserved; elapsed timings are observations.

- `baseline/` and `browser-after/`: fixed battle, knockout replacement and menu scenarios
- `native-before/` and `native-after/`, plus their `-2` and `-3` repeats: three captures
  per production build in unpackaged macOS Electron
- `reachable-after/`: early and late battle checkpoints earned through three seeded journeys
- `before.json` and `after.json`: Chrome DevTools Protocol layout/style counters around
  Collection navigation, battle entry and End turn, at 1280×720 with 125% text and
  1920×1080 with default text
- `before-*.png` and `after-*.png`: matching full-screen Collection and battle captures;
  all four settled pairs have identical decoded pixels
- `capture.mjs` and `motion.mjs`: task-local reproduction scripts; animation frames use
  a controlled clock and explicit artwork decoding

Live flight positions, dimensions, rotations, opacity and card faces matched at 180, 420
and 1,000 ms. Newly mounted draw clones use the equivalent CSS corner default until the
observer callback; the measured hand corner radius remains capped at 32px. Whole-frame
combat animation captures varied at the earlier samples, so those are inspected visual
evidence rather than a claim of exact animation-frame pixel parity; the 1,000 ms pair matched.

Opening Collection reduced style recalculations from 38 to 24 at 1280×720 and from
38 to 22 at 1920×1080. End turn layout counts fell from 313 to 302 and from 178 to
164 respectively. The short sample durations and timing variance do not support an FPS
improvement percentage. The baseline fixed scenarios already had no gaps over 20 ms or
observed long tasks on this Mac.

The browser replay retained roughly 16.8 ms p95 frame gaps, with one isolated 33.3 ms gap
in battle and one 66.7 ms gap in menus. Both earned early/late battle samples had no gaps
over 20 ms. Three native baseline p95 samples were 18.5/18.7/18.7 ms; treatment samples
were 18.4/18.6/18.6 ms. Baseline had one gap over 20 ms across the three captures;
treatment had one in each capture, up to 34.3 ms. None recorded a long JavaScript task.
These short, variable samples establish neither an FPS gain nor elimination of frame tails.
The observed work reductions must not be presented as an app-wide stutter cure.

Regression coverage protects observer cleanup, fallback measurement, batched live flight
geometry, avoiding repeated image-source writes, face flips, committed hand visibility,
input interruption, reduced motion and target preview behavior.

The three focused unit/DOM suites passed 36 tests. Production browser checks exercise
targeting, forecast bars, corner sizing, navigation/focus, denial, actual audio graph behavior,
hit recoil, reduced motion and mute. Final static and owning regression results are recorded
by protected integration; hosted CI and platform release gates are separate.

## Remaining qualification

The inspected startup path already batches image decode work in groups of four, yields
between batches and avoids retaining the complete decoded catalog. Audio already bounds
effect voices. Session persistence serializes admitted saves and keeps Cloud uploads off
the local save lane. These are useful existing controls, not evidence that those areas can
never hitch. No speculative caching, save reordering or quality reductions were introduced.

Further work should start with a failing trace: cold startup and screen entry under memory
pressure, long sessions and large earned inventories, busy feedback/controlled-creature
effects, rapid pointer/controller navigation, and display/overlay transitions on target
hardware. The existing [performance workflow](../DEVELOPMENT_TOOLS.md#reproducible-performance-captures)
provides deterministic replay and compatible comparisons. Keep the React Compiler trial
separate until repeated performance and rendered evidence supports adoption.

Browser simulation and unpackaged macOS Electron do not qualify packaged Windows,
physical controller, Steam client, Proton or Steam Deck presentation. No universal
stutter-free guarantee or unmeasured GPU/FPS improvement is claimed.
