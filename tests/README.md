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
| `tests/support/cards.ts`       | Complete ordered hand, draw, discard and buffer arrangements                           |
| `tests/support/combat.ts`      | Deterministic battle setup for isolated modifier regressions                           |
| `tests/support/tooling.mjs`    | Test-owned temporary directories, file fixtures and committed Git repositories         |
| `tests/e2e/`                   | Browser player flows; `expedition.spec.ts` retains the full starter-to-victory journey |
| `tests/e2e/support/`           | Browser saves, input, layout, evidence capture and journey driving                     |

`vitest.config.ts` discovers unit, integration and exhaustive suites, retaining each suite's Node or DOM environment. [CI](../Docs/CI.md#pipeline) owns partitioning and completeness against unfiltered discovery. Moving suites requires updating declared owner suites, explicit routes/documentation and affected fixed smoke selections; the owner-registry regression names missing paths and their owner; recursive full discovery must retain all three groups.

`tests/exhaustive/` contains extended matrices; [Contributing](../CONTRIBUTING.md#verification) owns command selection and execution. Full discovery must retain the complete matrix. [The lineup scenarios](support/lineups.ts) share the same command limit, seeded identities, save round trips and terminal/abandonment assertions between five fixed local trios and [the complete ordinary-lineup matrix](exhaustive/roster-combinations.test.ts). Its local contracts include coverage checks for every distinct ordinary trio and full-suite discovery. Preserve all exhaustive cases and assertions when separating these tiers; retain focused contracts for the changed boundary.

[Generated invariant tests](unit/game/generated-invariants.test.ts) use fixed fast-check seeds and bounded cases in the regular unit suite. They vary player choices and invalid commands across reachable checkpoints, replay each command, and check rejection and save contracts; targeted corruptions exercise save validation. They complement authored gameplay expectations and the lineup matrix, and do not establish balance or exhaustive coverage. On failure, retain fast-check's seed, path and counterexample; reproduce by temporarily passing the reported `seed` and `path` to the failing `fc.assert`, then add a focused regression for any consequential defect. Keep generated work bounded and follow the same local and CI execution policy as other tests.

Cloud controller and session scenarios share [an in-memory transport](support/cloud.ts); controller scenarios add the fixture-owned manager and installation spy, and Steam adapter scenarios share [a fake asynchronous native worker](support/steam.mjs). Each fixture owns its test-completion disposal; the Steam fixture also owns its temporary directory. Scenarios retain explicit disposal when testing shutdown, and retain their own timer restoration, blocked-operation release and failure injection. [Deferred barriers](support/deferred.ts) expose the promise and its release without scheduling or automatic cleanup.

Tooling suites use `temporaryDirectory` for cleanup at test completion, including failed setup and assertions. `repository` commits explicitly supplied fixture files with local Git identity and disabled hooks; process, socket and environment teardown stays with the scenario that owns it.

## Test value and coverage

[Creature recruitment](unit/game/creature-recruitment.test.ts) owns the shared encounter, discovery, recruitment and complete-kit save contracts. Its catalog-driven cases cover every ordinary species automatically, using an authored pack or a roster-conflict replacement and a compatible starter without fixing a seeded route. Named cases retain first-journey and progressed/repeat-recruitment setups; creature suites keep their distinct combat, preview, catalog and presentation assertions.

Protect consequential player behavior, command rejection, ownership, persistence, lifecycle ordering and architectural boundaries. First inspect existing protection and choose the cheapest layer that can detect the plausible failure. Strengthen a nearby assertion where useful. Adding no permanent test is appropriate when existing coverage is adequate or a change is documentation-only.

[Journey lifecycle replay](unit/game/journey-lifecycle.test.ts) exercises current seeded routes, accepted and rejected commands, rewards, save/resume and deterministic outputs. It chooses from the current offers and playable cards rather than requiring a fixed route when the content catalog changes. Replay checks consistency, not correctness by itself: the controlled encounter in creature recruitment and [journey earnings](integration/gameplay/journey.test.ts) assert concrete receipts, progression and rejection outcomes independently. Add focused expectations for changed rules instead of re-recording a whole journey when the catalog grows.

[Auto-play ranking baselines](unit/application/fixtures/battle-policy-rankings.tsv) retain each ordered command, score and reason for every creature in four battle conditions, including Talent and Boon effects. Each row is one choice; `null` represents an empty ranking. Preserve the recorded expectations for behavior-preserving changes and review changes to them as player-facing policy changes.

[Boon catalog checks](unit/game/boon-catalog.test.ts) cover approved rules, prepared portraits and individual save round trips once for every entry in the independent [expected rules](support/boons.ts). Focused Boon suites retain their separate mechanic and interaction scenarios.

Prefer focused behavioral assertions over tests of incidental implementation, markup or wrappers. Browser coverage should protect actual interaction and integration failures; arithmetic already covered in the engine rarely needs another browser journey. Test observable contracts instead of exact npm command strings, YAML formatting or internal call sequences. Keep literal assertions only where the literal itself is a public interface or authorization/security boundary. Never remove or weaken a regression test just to obtain a passing gate. Report exact suites run and remaining verification boundaries under [Contributing](../CONTRIBUTING.md#verification).

### Browser and UI coverage

Keep one seeded browser expedition that plays real battles, grows the lineup, resumes a save and reaches an outcome. Use focused scenarios for keyboard and simulated-controller navigation, targeting, swaps, rewards, recovery and menu focus. Browser controller simulation does not establish physical-device or packaged acceptance; [release qualification](../Docs/RELEASE_QUALIFICATION.md) owns those checks. DOM and game tests own exhaustive rules, rejection, focus, pagination and lifecycle behavior; add browser cases for distinct integration or rendering risks.

Ordinary browser specs import `test` from `tests/e2e/support/session.ts`. Its fixture rejects unexpected page errors, installs a browser clock before navigation and advances the startup minimum while waiting for readiness. Name intentional uncaught faults with `allowedPageErrors`; use `openHome` for new tabs. `startup.spec.ts` opts into `realStartup` for timing checks. Seeded fixtures must pass the current save decoder; replacing one clears its save and backups while retaining preferences. Keep player journeys isolated.

[Layout coverage](e2e/scroll-free.spec.ts) uses `LAYOUT_CASES` in `tests/e2e/support/layout-contract.ts`: both text sizes at 1280×720 and one at each other supported viewport. It checks Collection, Talents, battle hand and composition, including resize and focus return. This samples combinations rather than proving every content and display combination. Maintain the distinct layout and interaction cases when changing the matrix. The layout assertion permits named, focusable vertical reading regions only in Glossary, Settings and help dialogs; document overflow, horizontal scrolling and hidden clipping fail.

Reuse visits, fixtures and captures where state can remain shared without weakening assertions. Keep independent cases for persistence, disposal, competing focus owners and distinct input paths. Assert player-visible outcomes and saved state without deriving expectations from the production command. Use readiness and animation settling for transitions; captures wait for finite animations without fast-forwarding them. Keep screenshots for distinct visible states; failures retain screenshots and traces. [Evidence tests](e2e/evidence.spec.ts) protect settling behavior. Real startup and audio timing retain real-time observation; use the installed clock for held input and Auto-play deadlines.

Background-effects frame pacing belongs to `tests/performance/effects.spec.ts` and the scheduled/manual performance workflow. Effect videos are opt-in with `FAUNA_EFFECT_VIDEO=1`. Browser coverage and rendered reviews are separate from performance measurement and physical-device qualification.

## Static and accessibility checks

The lint gate enforces Hooks, accessibility, promise ownership and React Compiler immutability/ref/effect diagnostics. Any exception must be local, explain the specific ownership or DOM lifecycle requirement, and preserve behavioral coverage; mutable DOM nodes do not justify disabling checks across the application. Native ARIA roles remain valid where changing tags could alter layout or control contracts. Type-aware template coercion, string-sort style and test mock method binding are outside this gate. Prototype design labels are excluded from label association checks; player UI keeps those checks.

The ordinary desktop configuration checks all native code. `tsconfig.desktop-boundary.json` additionally requires explicit parameter types, unknown catch variables and exact optional properties in storage, preload, Steam transport/worker and resource/recovery boundaries. Remaining display/bootstrap code stays in the broader checked-JavaScript configuration while its consumers use typed native capabilities. Native wire results are validated before resolving those capabilities.

Automated accessibility scans in `tests/e2e/accessibility.spec.ts` cover home, all settings tabs, battle, pause, recruitment and Boon choices at the minimum viewport. WCAG A/AA violations fail ordinary browser CI, with violation JSON, an automatic failure screenshot and trace retained by the report pipeline. Layout journeys own successful screen captures; passing scans do not duplicate them. These scans supplement keyboard, controller simulation and rendered review; they do not establish manual assistive-technology or physical-device acceptance.

## Modifier contract baselines

[Modifier contracts](unit/game/modifier-contracts.test.ts) retain catalog/text hashes and deterministic traces for every recorded Talent, Boon and creature at six passive ranks, and a combined-reaction scenario. [Ability contracts](unit/game/ability-contracts.test.ts) cover authored abilities and their gameplay boundaries. Each trace includes commands, detached previews, ordered event/state results, RNG, visible Auto-play rankings and current-format save/resume. These are representative scenarios, not exhaustive trigger or interaction coverage; retain the dedicated Boon, talent, passive, reaction and creature regressions in full CI.

[Source-contract regressions](unit/tooling/modifier-contracts.test.mjs) cover missing, unknown, duplicate and empty bindings, wrong implementations, disconnected callers, undeclared interpretations and the existing scheduler. Source checking verifies ownership and connections; it cannot prove that a handler has the intended gameplay effect. Never refresh baseline hashes merely to accept a refactor.
