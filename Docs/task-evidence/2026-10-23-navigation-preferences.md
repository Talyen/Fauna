# Navigation and device preferences simplification

Implemented the two recommendations approved on October 23, 2026. The earlier numeric passive-tier proposal was withdrawn and moved to [history](../archive/PASSIVE_AUTHORING_PLAN.md); explicit complete passive tiers remain standard.

## Changes

- Shared directional focus follows declared navigation regions and rows instead of recognizing battle, Talents, Settings, inspection or replacement CSS classes. Dialog isolation, native composite controls, hidden/disabled filtering, row wrap and spatial fallback remain in their existing owners
- One device-preferences owner supplies defaults, normalization, patch updates and persistence for audio, background intensity, text/tooltip sizes, controller prompts and Auto-end turn. The three former hooks are removed, and Settings receives one value and update callback
- Existing storage keys and defaults remain. Independent batched audio patches merge against the latest state. Non-audio changes retain audio object identity so they cannot reconfigure playback. DOM scaling and audio application remain separate from preference persistence; native display state retains its adapter owner

Current contracts are in [UI](../UI.md#shared-components-and-enforcement). No gameplay, passive, save-format, artwork, stylesheet or dependency changes were introduced.

## Evidence scope

The task reused `.worktrees/passive-authoring-plan` and incorporated committed local main through `e3012e456f430c98329d819f8eb094ff30cfe9b7` before the final rendered review. Raw artifacts remain in that retained task checkout under the paths below. Review used the Fauna UI design/critique skills and the React component checklist.

### Focused local regression

`npm test -- tests/unit/ui/settings.test.tsx` passed all four tests in 1.62 seconds with the repository's one-worker, 30-second launcher. Coverage included batched independent preference updates, remount persistence, unavailable storage, live Settings controls and unchanged gameplay.

That run preceded the final non-audio identity safeguard and its additional assertion. The final assertion, input suite, audio/effects suites and broader coverage remain deferred to CI; the exact suite was not rerun under the one-focused-command-per-chat resource policy. The final source passed the lightweight gate and the rendered checks below.

### Rendered browser review

Final focused Chromium review completed against source identity `a8aa47cbd801569ed0e77d8d8bb35d87364740524f660f03fd5ad5c2571bde26`:

- `reports/navigation-preferences/1792814972679/report.json`
- Six whole-screen PNGs alongside it: Settings Sound/Display/Battle, battlefield, Talents and inspection
- 1280×720 CSS pixels, 125% text and reduced motion, with isolated contexts and quiet development preview
- All layout checks passed; no browser errors; start/end source identities matched

Exercised Settings WASD row movement and native slider adjustment, independent preference changes, reload persistence, Escape and opener focus restoration. Confirmed the progression save stayed identical. Exercised shared enemy/player row movement, Talents row navigation and unavailable Reset, return to overview, and inspection ability navigation/cancellation. Battle/Talents directional calls exercised the production shared navigation function; Settings/inspection also exercised keyboard routing.

Inspected all six fresh full frames for fit, reading order, artwork, contrast and focus. Settings controls and values fit, visible Settings/inspection focus remained clear, and the battlefield, Talents and inspection compositions remained bounded. No new artistic direction was proposed or approved, and no pixel-parity or performance claim is made.

Earlier diagnostic reviews are retained: `reports/navigation-preferences/1792814856545` used a five-second reload wait instead of the existing startup helper's 30 seconds; `reports/navigation-preferences/1792814911893` completed interactions but rejected identity because the harness read Vite-mutated environment state. The final harness snapshots the environment as the repository capture tool does. These incomplete attempts are not acceptance evidence.

A supplemental replacement-picker review completed against the same source identity and conditions at `reports/navigation-preferences/replacement-1792815064850/report.json`, with `replacement-focus.png` inspected. Initial focus selected the first living backup; Escape could not bypass the dialog; horizontal movement wrapped between the living choices; Enter committed one replacement and returned focus to the hand. Mana, turn and hand slots stayed unchanged. Its layout checks and browser error checks passed.

### Boundaries

`npm run verify:changed -- --base main` passed formatting, syntax/source contracts and documentation checks after the final runtime edits. Protected integration repeats its required gate over the combined result. Full compilation, broad suites and hosted CI remain pending. This review does not qualify Electron/native behavior, Windows packaging, physical controllers, Steam client/overlay or Steam Deck, and the quiet preview does not establish listening/mix quality. Owned browsers and preview servers were closed after capture.
