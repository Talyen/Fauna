# Test maintenance

[Contributing](../CONTRIBUTING.md#verification) owns execution policy. Read the sections below when changing test coverage or its infrastructure.

## Test organization

Keep complete scenarios with their contract owner; do not split or remove useful assertions to fit folders.

| Location                       | Responsibility                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `tests/unit/`                  | Focused game, application, platform, UI, tooling and simulation contracts              |
| `tests/unit/game/creatures/`   | Gameplay-only kits, including their save round trips                                   |
| `tests/integration/creatures/` | Complete cross-layer kit, Auto-play, save/resume and presentation scenarios            |
| `tests/integration/gameplay/`  | Journey, resource and feedback contracts                                               |
| `tests/integration/recovery/`  | Application/presentation recovery                                                      |
| `tests/support/game.ts`        | Shared gameplay scenario builders, independent of unit-suite directories               |
| `tests/e2e/`                   | Browser player flows; `expedition.spec.ts` retains the full starter-to-victory journey |
| `tests/e2e/support/`           | Browser saves, input, layout, evidence capture and journey driving                     |

`vitest.config.ts` discovers unit, integration and exhaustive suites in the same CI job, retaining each suite's Node or DOM environment. Moving suites requires updating declared owner suites, explicit routes/documentation and affected fixed smoke selections; recursive full discovery must retain all three groups.

`tests/exhaustive/` contains extended matrices governed by the [local/CI selection policy](../CONTRIBUTING.md#verification). `test:full` retains the complete matrix in CI and explicitly authorized heavy local execution; ordinary `npm test` runs only the fixed Node smoke set. The integration gate plans suites without executing them; use one exact suite with `npm test -- <suite>` for bounded local regression feedback. [The lineup scenarios](support/lineups.ts) share the same command limit, seeded identities, save round trips and terminal/abandonment assertions between five fixed local trios and [the complete ordinary-lineup matrix](exhaustive/roster-combinations.test.ts). Its local contracts include coverage checks for every distinct ordinary trio and full-suite discovery. Preserve all exhaustive cases and assertions when separating these tiers; retain focused contracts for the changed boundary.

## Test value and coverage

Protect consequential player behavior, command rejection, ownership, persistence, lifecycle ordering and architectural boundaries. First inspect existing protection and choose the cheapest layer that can detect the plausible failure. Strengthen a nearby assertion where useful. Adding no permanent test is appropriate when existing coverage is adequate or a change is documentation-only.

Prefer focused behavioral assertions over tests of incidental implementation, markup or wrappers. Browser coverage should protect actual interaction and integration failures; arithmetic already covered in the engine rarely needs another browser journey. Test observable contracts instead of exact npm command strings, YAML formatting or internal call sequences. Keep literal assertions only where the literal itself is a public interface or authorization/security boundary. Never remove or weaken a regression test just to obtain a passing gate. Retain full coverage in CI while keeping routine local work bounded. Report exact suites run and remaining verification boundaries.

### Browser and UI coverage

Keep one full starter-to-victory browser expedition with a validated winning seed. Application policy tests own choice scoring and loop prevention. Use seeded, bounded scenarios for keyboard/controller activation, combat swaps, rewards, save/resume, recovery and menu focus. Repeating a full expedition for each input mode adds cost without exercising directional navigation; the focused controller/menu journeys own that behavior. Controller coverage here is browser simulation, with physical-device and packaged validation governed by the release gates. Shared taps press and release within one browser-side frame sequence so driver latency cannot turn a tap into a held direction; deliberate hold/reconnect cases still control the pad explicitly.

Ordinary browser specs import `test` from `tests/e2e/support/session.ts`. Its fixture fails on unexpected `pageerror` events, including errors in newly opened tabs; intentional uncaught-fault experiments must name their allowed messages with `allowedPageErrors`. The fixture installs a browser clock before navigation, and `waitForStartup` advances the intentional splash minimum while still waiting for fonts, resources and a ready menu. Time runs normally after startup. `startup.spec.ts` opts into `realStartup` and retains real-time minimum, slow-resource, warm reload and reduced-motion checks. Use `openHome` for a new tab so its clock is installed before navigation. Seeded fixtures must pass the current save decoder before navigation. Seed markers preserve later committed saves on reload; replacing a fixture clears only its save and backups, retaining unrelated preferences.

[scroll-free.spec.ts](e2e/scroll-free.spec.ts) separates Collection, Talents/Glossary/Settings and battle-hand layouts into seeded cases. It uses `LAYOUT_CASES` in `tests/e2e/support/layout-contract.ts`: both text sizes at 1280×720 and one size at each other supported viewport. Talents caption fit, spacing and maximal artwork size share these six cases; reward journeys own team-selection captures. The six-card hit-target fixture uses targeted abilities so every slot can be clicked and cancelled without replaying saves; combat journeys retain instant-play outcomes. Its independently seeded cases retain:

| Surface                | Coverage                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Collection and Talents | Every kit/category at minimum size with enlarged text; first/last catalog entries/categories elsewhere, plus every Collection grid page |
| Battle hand            | Six-card dock geometry and real card hit targets from one battle per layout case                                                        |
| Composition            | Artwork profiles, ultrawide framing, reward anchors and hand overlap; Collection artwork area belongs to kit browsing                   |
| Live resize            | Later-page selection, filter memory and focus return between desktop and minimum sizes                                                  |
| Combat feedback        | All four text/motion combinations at minimum size                                                                                       |

This samples combinations; it does not establish every content/viewport/text/motion combination fits.

`tests/e2e/secondary-surfaces.spec.ts` exercises Glossary wheel, keyboard and simulated-controller scrolling through the final rule, Back focus return, and persistent save notices through automatic recovery. The shared layout assertion permits named, focusable vertical reading regions only in Glossary, Settings and help dialogs; document overflow, horizontal scrolling and hidden clipping still fail.

DOM tests own exhaustive rules, command rejection, focus ownership, pagination/resize and lifecycle cancellation. Screen suites may opt into `tests/support/ui.ts` for media/observer substitutes and cleanup; dedicated input, sizing, animation and disposal tests retain their own environments. Reuse one mounted application for catalog browsing when cases do not require fresh state; retain independent cases for disposal, persistence and competing focus owners. Menu focus covers every page/exit pair and both origins per page rather than their full Cartesian product. Add a browser case only for a distinct integration or rendering failure, and keep screenshots to distinct visible states (one per Boons page, rather than one per item on that same page). Preserve timing waits that verify held-input suppression, autoplay pauses or real audio; use state/animation readiness for ordinary transitions.

Owned Boons exhaust content and capture every page at minimum size; other viewports capture the first and last pages. Merchant shelf and purchased-state layouts run across `LAYOUT_CASES`, while Merchant resume and independent tooltip preference persistence run once at minimum size. Keep full state comparisons around browsing and purchases; viewport repetition is for rendered layout, not repeated persistence policy.

Replacement and boss-victory activation/focus run with mouse, keyboard and simulated controller; reload/resume runs once per feature. Campfire geometry runs at both authored viewport profiles, with healing/persistence/next-battle behavior checked once. Startup screenshots attach to the owning test like other rendered evidence. Background-effects frame-pacing observations live in `tests/performance/effects.spec.ts`, run by `playwright.performance.config.ts` in the scheduled/manual performance workflow; ordinary browser CI retains the behavioral WebGL, reduced-motion and palette checks. Effect videos are opt-in with `FAUNA_EFFECT_VIDEO=1`, rather than encoding every passing journey. Failure traces retain DOM snapshots and network evidence without recording a redundant screenshot filmstrip for every passing action; distinct rendered captures remain attached, and failures get an automatic screenshot.

Playwright listing verifies discovery only. Report measured execution time separately from case-count reductions; the CI browser report remains the runtime and rendered evidence source.

## Static and accessibility checks

The lint gate enforces Hooks, accessibility, promise ownership and React Compiler immutability/ref/effect diagnostics. Any exception must be local, explain the specific ownership or DOM lifecycle requirement, and preserve behavioral coverage; mutable DOM nodes do not justify disabling checks across the application. Native ARIA roles remain valid where changing tags could alter layout or control contracts. Type-aware template coercion, string-sort style and test mock method binding are outside this gate. Prototype design labels are excluded from label association checks; player UI keeps those checks.

The ordinary desktop configuration checks all native code. `tsconfig.desktop-boundary.json` additionally requires explicit parameter types, unknown catch variables and exact optional properties in storage, preload, Steam transport/worker and resource/recovery boundaries. Remaining display/bootstrap code stays in the broader checked-JavaScript configuration while its consumers use typed native capabilities. Native wire results are validated before resolving those capabilities.

Automated accessibility scans in `tests/e2e/accessibility.spec.ts` cover home, all settings tabs, battle, pause and recruitment at the minimum viewport. WCAG A/AA violations fail ordinary browser CI, with full JSON and screenshots retained by the existing report pipeline. These scans supplement keyboard, controller simulation and rendered review; they do not establish manual assistive-technology or physical-device acceptance.
