# Fauna roadmap

Last inventoried: October 21, 2026

Fauna has a complete short playable journey. Checked items below are implemented in the repository; they do not imply release readiness or fresh verification on every platform. Unchecked items are future work. Suggestions are not approved commitments or dated promises. Detailed rules remain in the linked design documents; [release readiness](RELEASE.md) owns shipping acceptance.

## Done: journeys and team building

- [x] First-journey starter selection from three seeded offers; later journeys draft three creatures from collected species
- [x] Eight combat encounters, with bosses fourth and last and enemy groups growing from one to three creatures
- [x] Recruitment from defeated enemies, including duplicate species with independent Health and battle state
- [x] Five-creature roster with three deployed creatures and two reserves
- [x] Full-roster recruitment with a cancellable release choice before committing a replacement
- [x] Remembered starting lineup, editable between battles
- [x] Free combat swaps preserving Health, effects and card positions without bonus draws or Mana costs
- [x] Persistent Health and knockouts between battles; defeat requires the entire roster to fall
- [x] Optional Campfire recovery for the whole roster, including knocked-out creatures
- [x] Independently rolled Recruit and Boon Merchant destinations at equal frequency, with open-roster and affordability criteria, saved three-Boon shelves, purchase rewards, fresh destinations after Merchant rooms and direct recruitment
- [x] Shared Victory screen for recruitment or intermediate-boss Boons
- [x] Final victory, defeat and return-home results with retained permanent earnings

Rules: [journey progression](EXPEDITION_DESIGN.md)

## Done: cards and combat

- [x] One shared deck, with three unique abilities contributed by each deployed creature
- [x] Exactly 1 base Mana per ability; four shared Mana and four draws each turn; seven-card hand
- [x] Draw/discard recycling and an ordered overflow buffer that fills opened hand slots and survives turn changes
- [x] Targeted and team-wide actions, healing, defense, utility and card-driven swaps
- [x] Physical, Burn, Poison, Bleed, Freeze, Stun, Nature, Light and Water damage mechanics
- [x] Block, Armor, Dodge, critical hits, Blind, Leech, Thorns, Water Thorns, Cleanse and Purge
- [x] Crowd-control windows and immunity, plus Death's Door protection against fatal damage
- [x] Enemy use of species abilities without immediate repeats; upcoming actions remain hidden
- [x] Target forecasts for Health damage, absorbed damage, Block, statuses and lethal outcomes
- [x] Inspectable draw/discard piles without exposing draw order
- [x] Optional Auto-end turn and per-battle Auto-play, paused by menus, inspection and loss of focus
- [x] Deterministic seeded outcomes, atomic rewards and rejected commands that preserve state and randomness

Rules: [keywords](KEYWORDS.md), [architecture](ARCHITECTURE.md)

## Done: collection and permanent progression

- [x] Twenty creature species and sixty unique base abilities
- [x] Mossguard, Emberback, Pollenmoth, Prismram and Captoad
- [x] Dunefox, Reedstag, Cindernewt, Coralcurl and Chimecricket
- [x] Dawncall, Bloomquail, Shadebrim, Ringpalm and Glintstride
- [x] Wickwaltz, Sternshell, Neradora, Stillara and Cadenza
- [x] Six distinct passive tiers per species, from zero to five stars, improved through permanent recruitment counts
- [x] Collection browsing with artwork, active traits, all three base abilities and rank progression
- [x] Separate encountered and recruited discovery records; recruitment determines the collected roster
- [x] Shared permanent keyword XP earned through accepted plays and banked on victory, defeat or return home
- [x] Fifteen talent categories with 135 distinct talents, row unlocks and immediate effects
- [x] Free category-wide talent resets that refund points while retaining XP
- [x] Permanent Gold retained between journeys and spendable at Merchants
- [x] Eighteen journey Boons shared between boss rewards and Merchants, with owned-Boon inspection

Catalogs: [content](CONTENT.md), [progression](EXPEDITION_DESIGN.md)

## Done: presentation, controls and settings

- [x] Production creature and action illustrations; prepared portraits for Boons and talent categories
- [x] Landscape creature and portrait action ArtCards, with names and rules outside the artwork
- [x] Hover/focus rules, keyword explanations and out-of-battle pinned inspection with rank pages and ability browsing
- [x] Visible targeting, unavailable-action feedback, Health/status readouts and knockout states
- [x] Combat numbers and impacts, hand draw/discard flights, swap motion and Campfire recovery feedback
- [x] Reduced-motion support and visible outcomes that remain understandable with sound muted
- [x] Mouse, keyboard and standard controller navigation, accessible names, modal focus and focus return
- [x] Paginated collection, talent and roster browsing with responsive artwork profiles and layout coverage from 1280×720
- [x] Separate text and tooltip sizing preferences
- [x] Recorded combat/interface effects, menu/combat/boss music, volume controls, Sound toggle and background mute
- [x] Display, Sound and Battle settings; native Windowed and Fullscreen modes on desktop

Design: [UI and required review](UI.md), [menus](MENU_DESIGN.md)

## Done: saves and desktop foundation

- [x] Offline browser play and an Electron desktop shell with separate save profiles
- [x] Automatic saves after accepted commands, two backups, current-format validation and silent recovery/retries
- [x] Serialized writes and graceful desktop close that drains admitted saves
- [x] Device-local preferences and bounded internal diagnostics separate from progression
- [x] Optional Steam runtime, account isolation, overlay pause and Cloud reconciliation adapters
- [x] Windows x64 packaging configuration, package-integrity checks and hardened desktop boundaries

Steam adapters still need Fauna's own App ID, external setup and live qualification. Packaging infrastructure does not establish installer, signing, Steam or hardware acceptance. See [release readiness](RELEASE.md).

## Done: development and verification tools

- [x] Isolated worktrees, task previews and locked local integration
- [x] Content validation, architecture/UI contracts, unused-code checks and documentation checks
- [x] Manifest-driven immutable media preparation, output integrity checks and active-media build budgets
- [x] Artwork comparisons/contact sheets and a Sound desk for audio review
- [x] Seeded headless journeys, replay, paired balance reports and ranked balance findings
- [x] Focused browser routes, interaction replay and reproducible performance captures
- [x] Unit/DOM and browser journey suites; CI orchestration for full checks, browser shards and Windows packaged smoke
- [x] Release identity/artifact verification and player-facing patch-note draft generation

Tools: [development tools](DEVELOPMENT_TOOLS.md), [verification policy](../CONTRIBUTING.md#verification)

## Next: finish and validate the current experience

These are known completion needs before substantial expansion:

- [ ] **Balance the complete journey:** playtest starter strength, team combinations, passive ranks, talents, Boons, Merchant value and Campfire recovery and optional-event frequency against clear difficulty and journey-length goals
- [ ] **Finish encounter and support artwork:** replace remaining placeholders through the prepared-media workflow and review them in the actual screens
- [ ] **Approve media and audio:** confirm source rights, track/effect selections, relative volumes and long-session listening comfort
- [ ] **Qualify rendered flows:** inspect exact-commit CI evidence for the complete journey, minimum viewport, enlarged text, tooltips and keyboard/controller navigation
- [ ] **Qualify Windows and physical controllers:** test installation, signing, save/resume, display changes and controller disconnect/reconnect
- [ ] **Complete Steam setup and live testing:** configure Fauna's App/depot, App ID and Cloud quota; verify overlay, account switching, offline divergence and recovery on two devices
- [ ] **Qualify Steam Deck:** test handheld readability, bindings, sleep/resume, offline launch and performance through the intended distribution path
- [ ] **Prepare release material:** finalize store assets, installer acceptance and privacy/crash-reporting decisions

These remain open until their own acceptance evidence is recorded. This inventory does not claim those gates have passed.

## Suggested future features

The groups below are in recommended order. Each proposal needs design and playtest review before implementation.

### 1. Make the first journey easier to learn

- [ ] **Short interactive introduction:** teach targeting, the shared deck, reserves and swapping with contextual moments, a Skip option and no repeated prompts for returning players
- [ ] **Creature synergy guide:** show concise collection examples of complementary keywords, passives and teammates
- [ ] **Recent battle history:** let players inspect recent actions and outcomes to understand an unexpected knockout or combo
- [ ] **Remappable controls and device prompts:** support custom bindings and broader controller layouts while retaining keyboard and mouse parity

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
- [ ] **Localization:** prepare player text for translation, then select languages and verify text fit and input behavior
- [ ] **Additional desktop platforms:** evaluate native Linux/macOS distribution after Windows and the intended Steam Deck path are qualified

Start with balance and first-journey learning, then challenge modifiers and encounter variety. Reassess larger content expansions after playtests show which teams and decisions players want more of. Multiplayer, accounts and live services are outside the current single-player roadmap.
