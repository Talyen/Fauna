# Fauna roadmap

Last inventoried: October 27, 2026

Fauna has a complete short playable journey. The current capabilities below are implemented in the repository; they do not imply release readiness or fresh verification on every platform. Unchecked items are remaining work. Suggestions are not approved commitments or dated promises. Detailed rules remain in the linked design documents; [release readiness](RELEASE.md) owns shipping acceptance.

## Current capabilities

| Area                 | Implemented scope                                                                                                                          | Rules and ownership                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Journeys             | Eight encounters, recruitment, five-creature roster, ordinary/Legendary deployment, persistent Health and optional support visits          | [Journey design](EXPEDITION_DESIGN.md)                                        |
| Combat               | Shared deck, targeting, statuses, forecasts, overflow, required replacements, generated cards and Legendary Minions                        | [Keywords](KEYWORDS.md), [Architecture](ARCHITECTURE.md)                      |
| Progression          | Collection, six passive tiers, shared keyword XP/talents, permanent Gold and journey Boons                                                 | [Content and catalogs](CONTENT.md)                                            |
| Presentation         | Illustrated ArtCards, inspection, combat motion/feedback, accessible mouse/keyboard/standard-controller flows and device-local preferences | [UI contracts](UI.md)                                                         |
| Persistence/platform | Offline browser/Electron saves, validated backups, graceful close, optional Steam/Cloud adapters and Windows package checks                | [Architecture](ARCHITECTURE.md), [Release](RELEASE.md)                        |
| Development          | Isolated worktrees, locked integration, media preparation, audits, replay/balance/performance tools and full hosted verification           | [Contributing](../CONTRIBUTING.md), [Development tools](DEVELOPMENT_TOOLS.md) |

Localization includes bundled English, German, Simplified Chinese, Russian, Spanish (Spain), Brazilian Portuguese, Japanese and French catalogs, device-local language selection and script fonts. The [localization guide](LOCALIZATION.md) separates enabled-language metadata, recorded browser review and remaining platform qualification.

Catalogs own current creature, ability, talent and Boon counts. Implemented adapters and passing automation do not establish live Steam or hardware acceptance.

## Next: finish and validate the current experience

Before substantial expansion:

- [ ] Balance the complete journey against clear difficulty and duration goals, including starter/team strength, ranks, talents, Boons and support-visit value; use the [first balance pass](archive/JOURNEY_BALANCE.md) as historical evidence
- [ ] Replace remaining encounter/support artwork placeholders and inspect them in play
- [ ] Approve source rights, artwork/audio selections, mix and long-session listening comfort
- [ ] Qualify current rendered flows, Windows, physical controllers, live Steam/two-device Cloud and Steam Deck through the [release checklist](RELEASE_QUALIFICATION.md)
- [ ] **Localization follow-through:** maintain translation freshness as content changes and qualify the enabled languages on release platforms; [localization](LOCALIZATION.md) records implemented support and review scope
- [ ] Finalize store material, distribution and privacy/support decisions under [release readiness](RELEASE.md)

These remain open until their own evidence is recorded. The release guide owns the detailed platform/setup requirements.

## Suggested future features

The groups below are in recommended order. Each proposal needs design and playtest review before implementation.

### 1. Make the first journey easier to learn

- [ ] **Short interactive introduction:** teach targeting, the shared deck, reserves and swapping with contextual moments, a Skip option and no repeated prompts for returning players
- [ ] **Creature synergy guide:** show concise collection examples of complementary keywords, passives and teammates
- [ ] **Recent battle history:** let players inspect recent actions and outcomes to understand an unexpected knockout or combo
- [ ] **Remappable controls and broader controller layouts:** add custom bindings and support beyond standard mappings while retaining keyboard and mouse parity; controller-family detection and manual prompt selection already exist in [Settings](ui/screens.md#settings)

### 2. Add reasons to replay

- [ ] **Optional challenge modifiers:** unlock harder journeys with clearly stated rules while preserving a welcoming baseline difficulty
- [ ] **Seeded challenge journeys:** offer reproducible runs with local best results; decide how permanent talents and ranks affect fairness before adding comparisons
- [ ] **Journey history:** record completed teams, Boons and outcomes in a separate menu while keeping results concise
- [ ] **Collection goals and achievements:** reward discovery, varied teams and encounter mastery; connect Steam achievements after their gameplay rules are settled

### 3. Expand journey choices

- [ ] **Optional event encounters:** offer compact risk/reward decisions alongside combat and test their effect on pacing
- [ ] **Branching routes:** introduce visible tradeoffs between encounters, recovery and rewards; prototype against the current eight-battle pacing first
- [ ] **More bosses and enemy formations:** test different team strengths while preserving the hidden-action battle design
- [ ] **More Boons:** broaden unusual team combinations before increasing the number of overlapping systems

### 4. Grow the collection and reach

- [ ] **Additional creatures:** fill demonstrated gaps in team roles, each with three unique abilities, six distinct passive tiers and complete artwork
- [ ] **Distinct journey regions:** explore themed enemy pools, bosses, music and locations if route variety improves replayability
- [ ] **Additional desktop platforms:** evaluate native Linux/macOS distribution after Windows and the intended Steam Deck path are qualified

Start with balance and first-journey learning, then challenge modifiers and encounter variety. Reassess larger content expansions after playtests show which teams and decisions players want more of. Multiplayer, accounts and live services are outside the current single-player roadmap.
