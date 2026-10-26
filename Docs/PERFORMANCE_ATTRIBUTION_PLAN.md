# Performance hitch attribution plan

At the October 23, 2026 implementation handoff, source was implemented and the focused regressions and rendered preview evidence below were recorded; full CI and native/performance captures were pending

## Goal and scope

Turn an observation such as “the battle had three frame gaps over 50 ms” into a reproducible explanation: which action was active, which application or presentation work overlapped the gap, what the browser recorded, and what remains unexplained.

Extend the existing harness rather than introducing another runner. Preserve gameplay, seeded outcomes, command/save ordering, audio, animation timing and visual quality. Keep `npm run perf`, `perf:replay` and `perf:compare` as the entrypoints. The accompanying change implements uncertainty-aware previews through the authoritative resolver; this instrumentation does not claim an optimization or a measured baseline.

[Development tools](DEVELOPMENT_TOOLS.md#reproducible-performance-captures) owns current capture behavior and [Contributing](../CONTRIBUTING.md#execution-and-evidence) owns execution permissions. `Alchemy: Docs/PERFORMANCE.md` is a sibling reference for phase correlation and trace analysis, not a runtime dependency.

## Pre-implementation baseline and gaps

- [The capture driver](../scripts/performance/run-performance.mjs) runs a validated checkpoint through normal controls, waits for its expected save, and samples a further 1,200 ms of presentation time
- It performs one warm-up and one measured run, supports Chromium and isolated Electron, and retains source/build identities, checkpoints and actions
- The sampler retains frame durations, long-task timestamps and input timings; unsupported observer types are null; shutdown drains pending observer records
- Action segments retain names, durations and frame counts, but discard their start/end timestamps; individual frames also lack timestamps
- [Metrics](../scripts/performance/metrics.mjs) report percentiles and gap counts over 20, 33.3, 50 and 100 ms and reject incomplete or incompatible comparisons
- [Fixtures](../src/tooling/performance.ts) cover battle, replacement and menus, with optional reachable early/late battles; [the weekly workflow](../.github/workflows/performance.yml) compares ordinary and React Compiler builds

At the assessment baseline, the harness could detect bad cadence but could not reliably join a particular gap to recorded input, command resolution, save encoding, hand motion or browser work. A segment combined automation delivery, checkpoint waiting and presentation. Startup latency was measured separately, but the frame sampler started after readiness and initial image decoding; it did not establish startup frame pacing. Normal battle scenarios also omitted selection/hover-only preview workloads.

## 1. Establish one bounded timeline

Keep browser measurements on the renderer's monotonic performance clock. Store frame intervals with start, end and duration; store the same coordinates for action segments, input entries and long tasks. Retain time-origin/capture identifiers so records from different navigations cannot be joined accidentally. Do not subtract Node launch timestamps from browser timestamps.

Retain the existing sampler warm-up before actions. Record explicit capture start/end markers. Validate finite, monotonic frame intervals, completed segments and expected checkpoint/action coverage. Drain observer records at shutdown as today. Add bounded inventories for frames, spans, observer entries and trace bytes, and a capture deadline; report truncation and invalidate attribution completeness instead of silently dropping evidence.

Record visibility, focus, motion preferences, actual viewport/DPR and available observer capabilities. A visibility or focus change during a foreground workload makes that capture unsuitable for timing comparison; unsupported APIs remain unavailable rather than zero. Treat ordinary pointer movement between in-page controls separately from window focus loss.

Introduce report format 3 and preserve old reports unchanged. Reject old reports for new replay/comparison with an actionable recapture message; no report migration is required. Record instrumentation mode and settings in comparison identity.

Acceptance: a fixture timeline can locate an individual 35 ms or 80 ms frame gap, its action window and overlapping input/task records, including records delivered only when observers drain. Invalid ordering and exhausted evidence budgets cannot produce a complete attribution report.

## 2. Add semantic spans at existing owners

Use a small optional recording capability supplied by renderer startup. Its default is inert. The renderer adapter owns clocks and browser APIs; application code receives typed start/end callbacks and imports no DOM implementation. Keep all instrumentation outside `src/game/`, with no gameplay changes or trace fields in saves. Sink failures must never change return values, exceptions, command admission or persistence ordering. Capture stop revokes recording and releases marks/listeners.

Start with these boundaries, adding nested detail only when evidence calls for it:

| Span or interval              | Owner and meaning                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input/action                  | Driver action window plus actual DOM input timestamp; distinguish delivery, processing and checkpoint acknowledgement                                                               |
| Command resolution            | [Session](../src/application/session.ts) around authoritative dispatch, labeled by command type and revision                                                                        |
| Save encoding and publication | Session around synchronous encoding/publication; nested spans must not be added together as independent CPU totals                                                                  |
| Save wait                     | Session queue admission, write start and acknowledgement as separate asynchronous intervals; waiting is not renderer CPU time                                                       |
| Target preview                | [Battle screen](../src/ui/battle/battle-screen.tsx) around preview computation and presentation-model calculation, labeled with current revision and stable action/target IDs       |
| Hand motion                   | [Hand motion](../src/ui/battle/hand-motion.tsx) geometry work and transition lifetime, with completion/interruption distinguished                                                   |
| Combat feedback               | [Feedback owner](../src/ui/battle/combat-feedback.tsx) adaptation/presentation work and scheduled sequence lifetime, retaining its existing interruption rules                      |
| Navigation                    | [Shell navigation](../src/ui/shell/navigation.ts) transition intent correlated with the committed destination surface; do not time a pure reducer as the entire rendered transition |

Wrap production callbacks at their existing invocation sites; do not add subscriptions that reorder publication or make command acceptance wait for an animation. React rendering and commit costs remain browser-trace observations unless a dedicated diagnostic profiling build is explicitly introduced and identified. A hook/render invocation is not itself a committed React update.

Include only bounded IDs, names and revisions in span metadata, not complete state or save strings. Run capture-only instrumentation in the same production build by enabling the optional adapter before startup; ordinary play must not accumulate a performance log. Avoid a new gameplay store or privileged IPC channel.

Acceptance: emitted spans correlate an accepted action through save admission/publication and visible feedback; rejection, reentrant subscribers, observer failures, interrupted animations and disposal preserve existing behavior. Repeated target changes measure preview work without committing state or advancing live RNG. No instrumentation change extends the game layer's allowed imports.

## 3. Report individual hitches and browser attribution

Generate a machine-readable hitch inventory and a short linked Markdown summary. List the twenty worst frame gaps above 20 ms, retaining all gaps in the bounded raw sample. Keep the existing 33.3/50/100 ms bands and duration-normalized rates; a 35 ms miss is useful evidence even without a long-task entry.

Each row includes frame interval/duration, scenario/action, overlapping semantic spans, nearby input delay, overlapping long tasks and available browser attribution. For a gap crossing two actions or phases, retain both; use interval intersection rather than whichever action happened to be active when an observer callback ran.

Feature-detect Long Animation Frames alongside existing observers. Retain supported timing breakdowns, blocking duration and script attribution with unavailable fields explicit. This API helps explain delayed rendering that consists of several smaller tasks, but its 50 ms threshold does not cover every 20–50 ms hitch. It is diagnostic evidence alongside frame intervals, not a replacement. See [Chrome's API documentation](https://developer.chrome.com/docs/web-platform/long-animation-frames) for supported fields and attribution limitations.

Separate semantic overlap, observed script/rendering work and unexplained time. Correlation identifies an investigation window, not proof that the overlapping feature caused the hitch. Concurrent/nested spans and observer entries are not additive CPU measurements. Do not infer disk CPU, GPU stalls or a memory leak from renderer gaps, write latency or heap deltas.

Acceptance: reports explain a sub-50 ms gap without a long task, a long frame composed of multiple tasks, overlapping animation/save intervals, and unsupported observer data. No-data cases cannot read as “zero blocking” or “no hitch.”

## 4. Add opt-in deep trace capture

Add a `--trace` diagnostic mode to the existing capture entrypoint, preserving its replay inputs and runtime selection. Use the runtime's supported Chrome DevTools Protocol connection after a capability check. Capture bounded renderer scheduling, JavaScript samples, User Timing and rendering events; omit screenshots by default. Close/flush the trace before disposing its task-owned page or Electron process, with explicit partial-artifact handling on errors.

Emit paired synchronization markers into the renderer sample and trace. Validate the clock mapping and identify the measured renderer main thread from trace evidence; never guess from event names alone. Missing synchronization/thread evidence makes attribution unavailable; trace overflow or dropped events makes the trace incomplete.

For each worst gap, clip events to that time interval and renderer thread. Report exclusive script work, style/layout/paint work when identifiable, and unaccounted time. Resolve nested event overlap without double counting; keep other-thread work separate. Include function names and emitted source locations where available. Preserve raw trace links for inspection in DevTools; source-map resolution is optional local evidence, not a reason to publish source maps.

Trace mode has different overhead and comparison identity. Never compare its FPS with ordinary captures. An automatic diagnostic recapture, if later enabled, must be separately labeled with its own sample/build/action identity; its trace cannot be presented as the explanation of an earlier untraced frame. Initially keep recapture explicit and bounded.

Acceptance: synthetic trace fixtures establish clock alignment, correct-thread filtering, interval clipping and exclusive accounting. Missing markers, dropped events and capture cancellation retain useful artifacts without a success claim. Capability checks cover Chromium and the selected Electron runtime independently.

## 5. Cover workloads that expose hitches

Retain fixed and reachable suites. Add narrow replayable actions for card selection, pointer/keyboard target changes and cancellation so hover previews and geometry are measured without a play. Assert no command, RNG or save change for those actions. This also supplies a baseline before any future uncertainty-aware preview work.

Add representative cases for area damage with passive reactions, multi-hit feedback, draw/hand overflow, required replacement, and Collection/inspection transitions. Prefer reached production checkpoints; label deliberate stress fixtures and their inventories explicitly. Do not claim unexercised talents, Boons or large content combinations were covered.

Keep the existing checkpoint acknowledgement and presentation window. Add explicit semantic completion observations where useful; record feedback that exceeds or is interrupted by the fixed window rather than hiding it by sleeping longer. Do not change animation durations or command availability to simplify measurement.

Keep cold-start process latency separate. Early renderer/startup hitch capture requires its own pre-navigation sampler/marker lifecycle and startup identity; defer it until action attribution is reliable. Do not claim startup hitch coverage from a post-ready idle sample.

Acceptance: replay preserves every state/checkpoint invariant while retaining intervals for previews, commits and feedback. A scenario cannot pass solely because it collected enough frames after a failed action.

## 6. Validate and roll out through hosted CI

1. Add deterministic timeline/metric/trace fixtures near [the existing tooling checks](../tests/unit/tooling/adoption-tools.test.mjs); test missing data, nested work, cross-boundary gaps, truncation and incompatible modes
2. Extend [performance fixture coverage](../tests/unit/simulation/performance-cases.test.ts) for newly recorded actions and checkpoint invariants; keep heavy reachable journeys in hosted CI
3. Add a capture-only synthetic stall scenario with a distinct identity, excluded from ordinary performance reports; prove the browser pipeline retains and locates a deliberate stall without depending on an exact duration or FPS
4. Verify the inactive/active recorder against command/save ordering and teardown contracts; conduct focused rendered review for any instrumentation touching motion lifetimes, including interruption and reduced motion
5. Extend the weekly/manual workflow to upload summaries, raw timelines and optional trace evidence even on failure; keep expensive tracing manual initially and preserve the existing compiler comparison
6. Measure recording overhead with equivalent controls, fixed inputs and the same runner; record the recorder version/settings and publish overhead separately from optimization results

Routine local completion uses the repository's lightweight gate. Future implementation starts with one exact focused regression within the local budget; builds, browser/Electron captures, broader suites and performance trials belong in hosted CI unless explicitly authorized for local execution. Follow the shared Mac resource lane for authorized heavy work.

## Completion criteria and delivery order

Land timeline/schema support first, semantic spans second, hitch summaries/Long Animation Frames third, deep tracing fourth, and expanded workloads/CI qualification last. Update the existing tool guide as each capability actually ships; do not document proposed flags as available commands.

The extension is complete when a selected hitch can be opened from a summary, tied to replayable input and a valid checkpoint, inspected against its semantic timeline, and investigated with supported browser/trace attribution or an explicit explanation of unavailable evidence. Correctness and capture completeness are gates; timing targets remain advisory until repeated observations justify a separate policy change.

Report Chromium, unpackaged Electron, packaged Windows, physical controller, Steam client and Steam Deck evidence separately. Browser rAF timing measures renderer cadence, not hardware GPU presentation. Hosted-runner timing does not establish desktop/Deck smoothness, and instrumentation alone does not prove a performance improvement.

## Implementation and verification record

All six delivery areas have source implementations: format-3 frame/segment timelines and bounded observers; failure-isolated semantic spans; linked hitch summaries and Long Animation Frames; opt-in CDP traces with exclusive accounting; preview, reaction and repeat/overflow fixtures; and hosted diagnostic/overhead coverage with optional manual traces. Source owners remain linked above. The initial startup-hitch extension remains deliberately deferred as specified in stage 5.

The preview change explores at most 128 replays, 64 pending/completed alternatives, 64 branching decisions per replay and 4,096 combat scheduler steps. It retains complete correlated worlds only while projecting, caches twelve presentation models per immutable snapshot, and does not change saved state, format or live RNG ordering. Hidden draws, unclassified random sampling and exhausted budgets retain authored rules with an unresolved readout.

Local focused regression coverage lives in [uncertain-preview-attribution.test.tsx](../tests/unit/ui/uncertain-preview-attribution.test.tsx). It covers seed-independent projection, Dodge/retaliation correlation, conditional knockouts, hidden/bounded fallback, recorder failure isolation, reentrant save ordering, fixture replay, timestamp correlation, incompatible comparisons and exclusive trace accounting.

Focused rendered evidence and interaction checks are retained under task-owned ignored reports; the [task evidence](task-evidence/2026-10-23-uncertainty-and-attribution.md) records paths and conditions. Broader unit/type/build validation, real performance/overhead measurements, CDP runtime captures and native/device qualification remain separate pending gates; synthetic unit traces do not establish native trace support or frame pacing.
