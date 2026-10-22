# Unify ability resolution

Status: implemented; exact-commit CI and rendered verification are reported in the task handoff

Assessment baseline: local commit `4911cd6`, 2026-10-21

## Problem and scope

Fauna had one command entry point but two ability interpreters. `finishTurn` and the player `play` case in [engine.ts](../../src/game/engine.ts) separately resolved targets, repeats, primary effects and follow-up effects. The enemy chain treated unhandled primary effects as Block; the player chain could silently omit an effect. A string allowlist independently filtered enemy extras in [content.ts](../../src/game/content.ts).

This was an ownership problem in frequently extended creature rules. Splitting the engine into smaller files without removing the duplicate interpreters would not address it. Phase-specific state typing and UI navigation concentration remain separate possible work; they are outside this refactor.

## Approved rule decisions

Players and enemies use one shared ability pipeline and authored base values. Existing differences are not automatically preserved. The user approved these decisions during implementation:

- Enemy room difficulty scales additively: Health and ability damage, healing and Block gain 10% per room after the first, from 100% in room one to 170% in room eight. Supplemental ability damage/healing follows the same rule. No replacement encounter attack strength or area-damage division remains.
- Chance percentages, effect counts, resource grants and passive tiers do not scale with room power. Mixed Block-or-Thorns protection scales the Block branch only.
- Both sides have 5% base Critical chance and use half maximum Health for Stun/Freeze buildup.
- Enemies receive no automatic one-Health round healing. Authored healing abilities and passives still work.
- Death's Door remains an explicit player safety mechanic. Talents, Boons, collected passive ranks, upgrades, hand, Mana and discard remain player-owned. Enemies retain base passives and AI action/target selection.

These are deliberate behavior changes. Matching historical enemy outcomes or RNG after the new Critical checks is not an acceptance requirement. Unchanged player ability resolution, immutable publication, ownership and settlement contracts still require regression coverage.

## Resulting owners

| Owner                                                                                     | Responsibility                                                                                                                                      |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [abilities.ts](../../src/game/combat/abilities.ts)                                        | Single synchronous execution sequence, targeting, repeats, primary effects, recipient extras and global extras                                      |
| [ability-values.ts](../../src/game/combat/ability-values.ts)                              | Exhaustive primary/extra magnitude policy shared with descriptions; no resource/chance scaling                                                      |
| [ability-rules.ts](../../src/game/ability-rules.ts)                                       | Shared intrinsic values and passive bonuses; player upgrades and enemy room power supplied explicitly                                               |
| [content.ts](../../src/game/content.ts) and [card-rules.ts](../../src/game/card-rules.ts) | Authored definitions, descriptions and exhaustive enemy repertoire/resource adaptation                                                              |
| [engine.ts](../../src/game/engine.ts)                                                     | Validate before mutation/RNG; pay Mana; move card slots; award XP; invoke execution; count accepted plays; refill hand; schedule turns; settle once |
| [combat.ts](../../src/game/combat/index.ts)                                               | Shared packets, defenses, healing, statuses and reactive effects                                                                                    |
| [encounters.ts](../../src/game/encounters.ts) and [save.ts](../../src/game/save.ts)       | Construct and validate exact room power and initial Health; reject obsolete development formats                                                     |
| [session.ts](../../src/application/session.ts)                                            | Publish accepted state/events and serialize saves                                                                                                   |

The executor runs inside the existing command draft. It does not dispatch commands, open another transaction, settle rewards, save, publish or await animations. A narrow swap operation supplied by the engine avoids importing orchestration into execution. Friendly/opposing rows are read again for each resolution so swaps and knockouts cannot leave stale group targets.

Enemy intent and friendly-target selection remain scheduler policy. Random ability targets are chosen once for the whole ability, including repeats. Enemy inspection uses the same room power and supplemental-value policy as combat. Both primary and extra execution are exhaustive, as are primary magnitude and enemy-support decisions.

## Implementation sequence and acceptance

1. Establish the existing engine/combat/preview baseline and retain valuable species, ownership and persistence regressions
2. Replace implicit enemy support filtering with exhaustive primary/extra decisions
3. Move primary effects and extras to a shared execution owner, then consolidate repeat admission and per-repeat liveness/attack setup
4. Align the approved rules and replace encounter damage with explicit persisted room power; update schema, fixtures, descriptions and inspection together
5. Review the final combined diff, run task-scoped and focused checks, integrate through the shared lock, observe exact-commit hosted CI and inspect rendered combat evidence

Completion requires one executor, no generic Block fallback, exact depth scaling, shared rules and explicit ownership exceptions. A smaller engine file alone is insufficient. Regression coverage must protect:

- Mirrored player/enemy combat effects at base room power across supported authored abilities
- Scaling of damage, healing and Block without changing chances/counts/resources or scaling twice
- Shared Critical/control rules, no unearned enemy healing, and explicit player-only survivability
- Repeat limits, actor/target death, recipient Cleanse before global extras, swaps and hand overflow
- Full command-result equality across save/resume, including RNG and ordered events
- Detached previews, rejected-command identity/RNG, once-only rewards and save/command ordering
- Displayed primary and extra amounts matching combat at later room power

No new dependencies, compatibility migrations, legacy resolver, asynchronous gameplay or general combat-reaction rewrite is required.

## Verification record

The baseline engine, combat and presentation suites passed 1,186 tests before implementation. Task checks and focused regressions cover shared execution, depth scaling, save/resume and inspection. The full browser expedition retains its 400-command bound with an updated fixed seed after the approved rules changed; its matching command test completes in 201 commands. Full static checks, complete units, builds, browser journeys/replay and Windows package validation remain CI-owned under [Contributing](../../CONTRIBUTING.md#verification).

The final handoff must identify the evaluated commit and CI outcome, distinguish local tests from rendered evidence, and report unrun physical-controller, Steam client and Steam Deck checks. Existing saves are disposable development data; the schema version changes without a migration.
