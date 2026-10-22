# Alchemy feature adoption plan

This is a historical delivery record, not a current implementation checklist. Later decisions supersede its diagnostic export/Retry UI, five-species starter pool, Known/Unknown Collection filters, fixed artwork sizes and worktree-cleanup restrictions. Current behavior belongs to [Architecture](../ARCHITECTURE.md), [Content](../CONTENT.md), [UI](../UI.md), [journey design](../EXPEDITION_DESIGN.md) and [Contributing](../../CONTRIBUTING.md). Implementation or verification statements below describe that rollout only; they do not establish acceptance of current main.

Adopt Alchemy's audio, volume controls, Collection discovery, talent XP curve, headless playthroughs, content validation, manifest-driven asset preparation, owned previews and worktrees, and local diagnostics. Keep Fauna's creature roster, free combat swaps, command ownership, fixed artwork sizes, shadcn controls, and lightweight local verification policy.

Implementation is present on the task branch for all stages; local focused checks and media preparation are covered during handoff. Full CI, rendered review, listening/mix acceptance and physical platform checks remain pending. This plan records the delivery scope. It does not change current gameplay or authorize pushes, publication, or broader local validation. References were checked against Alchemy `6222f0523` and Fauna `96aef22`. Alchemy is a source reference; Fauna will have no runtime dependency on its sibling checkout.

## Scope and delivery order

| Stage | Deliverable                                             | Dependency                                                   |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------ |
| 1     | Owned worktree setup and preview lifecycle              | Existing protected integration                               |
| 2     | Expanded content validation and local diagnostic export | Existing content, application, and platform owners           |
| 3     | Seeded headless journeys and deterministic replay       | Content validation; diagnostics can share report conventions |
| 4     | Alchemy talent XP curve                                 | Boundary tests and headless baseline                         |
| 5     | Collection discovery and browsing                       | Content validation and current-format save updates           |
| 6     | Manifest-driven asset preparation                       | Content validation; independent of Collection implementation |
| 7     | Recorded audio, music, and volume controls              | Prepared media; diagnostic sink                              |

Each stage should be a reviewable change in an isolated task worktree, integrated through `scripts/integrate.mjs` after the required local gate. Stages 4, 5, and 6 can proceed independently after their prerequisites. Keep save-contract edits together when stages overlap; re-read current main before integration.

Out of scope: the distinct ten-talent catalog, new boon mechanics, difficulty modes, localization, Homestead, crafting, additional currencies, non-combat locations, cloud saves, achievements, and automatic battle play. The previously approved distinct-talent work remains separate; this plan changes its XP pacing only.

## 1 Owned previews and worktrees

Add a small Fauna-specific setup command that creates a named task branch and worktree from committed local main, or reuses the current task's suitable checkout. Link unchanged dependencies to the main checkout; dependency changes require an installation appropriate to that worktree. Keep the current locked integration script as the integration owner.

Add task-owned preview sessions with an allocated localhost port, isolated browser storage, and a recorded process/session identity. Browser and desktop launchers must use the selected port rather than assuming `48209`; readiness must verify the intended application instance. Use a fresh browser context for experiments. Keep normal launch behavior simple when no task session is requested.

Cleanup may close only a session created by that task, after checking its identity. Occupied ports must lead to another port or a clear error. Never stop an arbitrary server, erase player saves, remove another task's lock, or delete worktrees automatically. Do not inventory or poll chats.

Acceptance:

- Two task previews run concurrently without sharing saves or attaching to each other's server.
- Closing one preview leaves the other preview and unrelated processes running.
- Readiness failure cleans up only the processes started by that launch; stale ownership records cannot authorize killing a reused process ID.
- Worktree setup preserves dirty main and unrelated branches. Integration still requires clean main and the shared lock.

Reference: `Alchemy: scripts/agent-browser.mjs`, `Alchemy: scripts/lib/agent-browser-session.mjs`, and `Alchemy: scripts/agent-worktree.mjs`. Adapt ownership patterns without importing its server-stop or automatic worktree-removal behavior.

## 2 Content validation

Expand the existing `validateContent()` contract in `src/game/save.ts` into a pure, structured validator with a compact command-line report. Keep save decoding separate from authored-content checks while preserving existing startup validation. Avoid introducing a second definition of valid content.

Validate species/card ownership, exactly three distinct cards per species, unique and known IDs, finite supported values and costs, recognized effects and keywords, encounter packs, boss positions, boon and talent references, row prerequisites, and consistent keyword classification. Validate displayed effect amounts and descriptions where structured definitions permit it; use focused outcome tests for handwritten passive and talent descriptions. Do not claim arbitrary prose is proven correct by string matching.

Add filesystem checks at the tooling boundary for registered artwork/media, required aspect ratios, and prepared manifests. Distinguish errors from advisory tuning warnings. Reports identify the content ID, field, and reason, with JSON for automation and concise text for development. CI runs comprehensive authored-content checks; retain the bounded default local gate.

Acceptance: deliberately invalid fixtures produce actionable diagnostics for broken references, missing media, and description/effect disagreements; valid authored content passes without booting React or consuming gameplay RNG.

Reference: `Alchemy: src/lib/content-validation/` and `Alchemy: scripts/content-audit.mjs`.

## 3 Local diagnostics

Add a bounded local error collector at application/platform boundaries for startup, render failures, save reads/writes, validation, and audio failures. A failed sink must not interrupt commands, saving, or shutdown. Deduplicate recurring failures and bound both entry count and payload size; protect against circular values and recursive logging.

Expose a quiet Settings action to inspect and explicitly copy/export a report. Include build identity, platform, game revision, phase, error category, and useful technical details. Keep raw diagnostic messages unchanged. Exclude full saves, arbitrary localStorage, credentials, and unnecessary absolute paths. A separate deliberate development export can supply a checkpoint to the headless runner; routine error collection must not capture it implicitly.

Store diagnostics separately from progression. Persistence and clipboard/download access belong behind platform capabilities; storage failure must leave an in-memory report usable. No telemetry, automatic upload, or network service is introduced. Save errors retain their existing actionable Retry flow.

Acceptance: a save failure yields a useful report, report-copy failure has visible feedback, repeated audio failures stay bounded, and disposal removes listeners and subscriptions. Exporting diagnostics changes neither gameplay state nor save revision.

Reference: `Alchemy: src/lib/error-logger.ts`, `Alchemy: src/features/alchemy/shared/stores/error-log-store.ts`, and `Alchemy: src/features/alchemy/meta/screens/options/error-log-viewer.tsx`.

## 4 Headless journeys and replay

Build an opt-in Node runner around Fauna's production application session, commands, and save codec, using in-memory platform ports. Cover starter choice, destinations, card plays, end turn, swaps, recruitment and replacement, boon selection, talent purchases/resets, final results, and new journeys. Include repeated journeys with earned permanent progress and explicit save/resume checkpoints.

Use separate seeded randomness for actor decisions; observing choices must not consume gameplay RNG. Enemy intents remain hidden to the actor. Read only player-visible information when scoring choices; do not use internal target IDs or future offers. Begin with random-legal and simple heuristic policies, including reserve recovery. Report policy limitations rather than treating automated win rates as human balance.

Record the initial checkpoint, content/build identity, scenario configuration, attempted commands, acceptance/rejection results, and state/RNG checkpoints. Replay the recorded commands directly and fail on divergence. Compare runs only when seeds, starting progression, policy, and budgets are compatible; report any intentional tuning difference. Read current-format saves through production validation rather than importing unvalidated data.

Use per-scenario action/turn limits and an external child-process watchdog. A hang, unsupported choice, or exhausted budget is incomplete evidence, never a defeat or successful journey. Keep reports under ignored `reports/`; provide compact summaries with links to detailed journals.

Acceptance:

- Fixed inputs replay to the same outcomes, state, and RNG across save/resume.
- Scenarios exercise a full roster, replacement cancellation, duplicate species, fallen deployed creatures with healthy reserves, boon choices, and both victory and defeat.
- Reports show starter/team composition, encounter reached, battle length, retained XP/currency, recruitment and swap decisions, failure reasons, and incomplete scenarios.
- Focused CI cases protect command and replay contracts; large balance sweeps stay opt-in or in dedicated CI jobs. Simulation does not establish rendered quality.

Reference: `Alchemy: Docs/PLAYTHROUGH_SIMULATION.md`, `Alchemy: scripts/run-playthrough.mjs`, and `Alchemy: src/lib/balance/`.

## 5 Talent XP curve

Adopt current Alchemy's early-point discount. For point count `n`, the cumulative XP threshold is `10 × n × (n + 1) − 10 × min(n, 2)`. The first thresholds become **10, 40, 100, 180, 280**; incremental costs are **10, 30, 60, 80, 100**. This replaces Fauna's current cumulative 20/60/120 progression.

Own threshold calculation, inverse point calculation, available points, and progress-bar fractions together in `src/game/progression.ts`. Ensure rounding cannot grant a point one XP early, including at large supported values. Preserve one XP per eligible keyword per accepted play, atomic banking, category resets, and current talent availability limits. Do not copy Alchemy's extra Health per talent point, run XP multipliers, talent effects, or hero rules.

Update Talents, earnings/results consumers, save validation, fixtures, and the pacing sections of `Docs/EXPEDITION_DESIGN.md` together. Raw keyword XP remains the source of truth; derived point counts are recalculated. Follow the disposable-development-save policy if a format change is necessary; add no migration layer.

Acceptance: test immediately below, at, and above each early threshold, supported upper bounds, purchased-point budgets, category reset, results progress, and save/resume. Compare fixed headless careers before and after the change, reporting time to first/second point and earned progression without making a human-balance claim.

Reference: `Alchemy: src/lib/game-data/talents/progression.ts` and `Alchemy: Docs/TALENT_RULES.md`.

## 6 Collection discovery

Separate permanent knowledge from starter eligibility. Proposed behavior: initially available starter species are known; committing Combat or Boss discovers the exact encountered enemy species and their collectible kits; accepted recruitment records that the species has been recruited. Viewing the encounter screen does not discover enemies. Recruitment during a journey does not independently unlock that species as a future starter. The current five-species roster is eligible from the first journey; the retired Moonhart victory unlock has been removed.

Record discovery atomically in gameplay commands, retain it after defeat or abandonment, and validate it in the current save contract. Do not infer historical encounters from currency, wins, or the current roster. If new fields require a save-version change, update all current-format fixtures and reject obsolete development saves.

Keep Collection focused on creatures and their three-card kits. Show concise Encountered, Recruited, and Starter states where useful; keep unknown entries visually locked without exposing undiscovered details. Reuse existing inspection and fixed ArtCard dimensions. Add a simple All/Known/Unknown filter using registered primitives; introduce pagination only when content growth needs it. Keep filter state transient and preserve focus when returning from inspection or the menu.

Acceptance: browsing never mutates progress; the encounter screen grants no discovery; an accepted encounter does; duplicate species do not duplicate permanent records; discovery survives loss, return home, and save/resume. Rendered review covers locked entries, filters, empty states, enlarged text, and keyboard/controller focus return.

Reference: `Alchemy: src/features/alchemy/meta/screens/collection-screen.tsx` and its collection helpers. Discovery timing and the exact labels above are proposed implementation defaults, not existing Fauna behavior.

## 7 Manifest-driven asset preparation

Introduce a Fauna-owned manifest selecting source-library files and processing recipes for creature/action/location art, keyword art, boons, sound effects, music, and required interface media. Preserve existing placeholders until explicitly replaced. Share approved source files where appropriate, but keep Fauna's selections, output paths, recipes, and preparation receipts independent of Alchemy.

Use a configurable library root and library-relative selections. Receipts record source hashes, selection/recipe identity, and output hashes. Validate every selected source before publishing outputs, stage generation before installation, and leave the last good prepared set usable after a missing source or failed conversion. Never delete library originals or unrelated local-only files. Limit any obsolete-output cleanup to manifest-owned outputs with explicit ownership evidence.

Provide explicit prepare, full source-check, and output-only check commands. Ordinary development/builds consume prepared outputs without rewriting tracked sources. CI validates committed outputs and manifest consistency without downloading the source library. Record source provenance and usage rights per selection rather than assuming every shared library file is approved for shipping.

Generate asset lookup data from the manifest and connect media completeness to content validation. Enforce separate 4:3 creature/location and 3:4 action/boon compositions; processing must not stretch or silently crop one into another. Source resolution does not change Fauna's fixed CSS display sizes. Prefer existing encoders/libraries where they fit; document any required new dependency and its concrete role.

Acceptance: missing/offloaded sources, changed recipes, corrupt outputs, conversion failure, duplicate outputs, and interrupted preparation fail safely; output-only checks work without the library; repeated preparation is stable. Test pipeline behavior with tiny fixture media rather than requiring the full production library.

Reference: `Alchemy: Docs/WORKFLOWS-ASSETS.md`, `Alchemy: scripts/assets.mjs`, and `Alchemy: scripts/assets/`.

## 8 Audio and volume

Replace synthesized prototype tones with approved prepared recordings while retaining Fauna's committed-event cue selection. Add curated menu/combat/boss music where suitable approved media exists. Use one semantic playback facade; UI and game code do not own media elements. Gameplay, progression, input acceptance, and save ordering must remain independent of playback and animation.

Map damage types, Healing, Block/absorption, rejected actions, knockout, victory/defeat, recruitment, talent purchase, and other supported actions to an explicit cue or intentional silence. Preserve one focal cue per resolved action; separate music and limited outcome stingers must not cause repeated playback on rerender, inspection, load, or results reopening. Keep essential outcomes visible while muted.

Add Master, Music, and Sound effects volume controls plus Mute in background, using registered upstream shadcn primitives. Normalize percentage values in one preferences owner, persist separately from game saves, and apply changes live. Preserve a convenient mute control. Defaults should use conservative levels and background muting; approve the final mix by listening. Do not add unrelated display effects or autoplay settings.

Own audio unlocking, best-effort preload, finite caches/voices, fades, background/visibility behavior, track replacement, and disposal below UI callers. Loading media never blocks startup. Late callbacks from an old track cannot dispose or restart its replacement. Pausing must not replay action cues; quiet automated previews must not take audio ownership from an active player window. Playback errors enter bounded diagnostics and leave the game playable.

Adapt Alchemy's Sound desk into a small manifest-backed audition tool with current/candidate comparisons, consistent preview levels, explicit choices, and choice export. Auditioning must not install production replacements or modify sources. Source hashes and provenance travel with choices; metadata checks do not replace listening.

Acceptance:

- Volume and mute changes apply during playback and survive restart independently of progression.
- Rapid music changes, failed decoding, suspended audio, backgrounding, disposal, and late callbacks cannot leak or resurrect voices.
- Save/resume and UI remounts do not repeat rewards or outcome sounds.
- Listening review covers combat overlap, loops/fades, low volume, mute, and ordinary headphones/speakers; report the actual devices and host used.

Reference: `Alchemy: Docs/AUDIO.md`, `Alchemy: src/lib/audio/`, `Alchemy: scripts/audio-review.mjs`, and `Alchemy: src/features/alchemy/meta/screens/options/options-panels.tsx`.

## Verification and handoff

Run focused tests that protect the changed contracts, followed by `npm run check -- <task-owned paths>` before handoff. Documentation-only stages need formatting checks, not new gameplay tests. Keep the default smoke suite bounded; do not add asset conversions, balance sweeps, browser launches, or full static checks to it.

CI owns full static checks, all unit/DOM suites, production builds, browser journeys and screenshots, Windows packaging, and packaged desktop smoke. Extend those suites for Collection, settings, diagnostics, and current-format save behavior. Inspect the rendered evidence for each UI change, including 1280×800, large text, reduced motion, keyboard and simulated controller navigation. Local previews, listening sessions, or broader local checks run when explicitly requested; their tools being implemented does not itself authorize running them.

For each stage, report the integrated commit, focused/local checks, pending CI/rendered evidence, and any unresolved asset choices. Distinguish browser simulation, native desktop, Windows packaging, physical controllers, Steam client, and Steam Deck. Do not mark media quality accepted from hashes, geometry, or unit tests alone. Stop after the requested deliverable; remote publication remains separately authorized.

## Follow-up adoption: approved implementation

Replace the shared talent set with two talents per consolidated category, replace four relics with four illustrated Boons, and add independent tooltip sizing. The user delegated selection. Both talents are eventually available, either may be purchased first, and category reset preserves XP. Difficulty tiers are explicitly excluded; Forge is removed instead of expanded.

| Category | Selected talents               |
| -------- | ------------------------------ |
| Physical | Shield Slam, Armored Fists     |
| Burn     | Flashpoint, Melting Point      |
| Freeze   | Bitter Cold, Glacial Barrier   |
| Stun     | Guarded Counter, Shatter Guard |
| Poison   | Necrosis, Torpor               |
| Nature   | Bramblegrowth, Ecosystem       |
| Light    | Faith Barrier, Blessed Leech   |
| Bleed    | First Blood, Mortal Wound      |
| Block    | Second Wind, Grounding         |
| Health   | Mending, Renewal               |
| Armor    | Bulwark, Reactive Guard        |
| Dodge    | Lightfoot, Catch Breath        |
| Leech    | Deep Siphon, Desperate Siphon  |
| Mana     | Wellspring, Dark Recovery      |

Boons are Tattered Pages, Bone Charm, Ironwood Buckler and Icy Heart, including copied artwork and prepared receipts. Keep intermediate-boss choices of three and normal rewards. No result-screen inspection is added. Concise rules use percentages and implied ownership; exact resolution belongs in focused gameplay tests and the keyword contract.

Development additions are seeded rendered interactions with replay and bounded shrinking, named browser routes, native Electron and cold startup captures, and reachable seeded-journey performance checkpoints with coverage inventories. Extend existing harnesses and application/save interfaces; never import Alchemy at runtime. See [Development tools](../DEVELOPMENT_TOOLS.md#focused-routes-and-seeded-interactions) and [native performance](../DEVELOPMENT_TOOLS.md#native-and-reachable-performance-scenarios).

Delivery order: combat/catalog and save version 13; Boon art/menu and tooltip preference; tooling and focused regression/documentation coverage. Review the complete task diff, run selected formatting/smoke and docs checks, then commit and integrate through the shared lock. Broader rendered/native/performance checks follow the user's local-review authorization; Windows packaging remains CI-owned. Report actual checks and pending boundaries.
