# Creature design

Design a creature whose artwork, passive and three abilities express the same identity, and whose presence changes a player's choices. Use the [creature design skill](../.agents/skills/fauna-creature-design/SKILL.md) for this workflow. [Content contracts](CONTENT.md) own authored rules, costs, passive tiers and media preparation; [journey design](EXPEDITION_DESIGN.md) owns deployment, encounters and recruitment. This document adds design guidance without rebalancing existing kits.

## 1. Inspect the artwork

Start with the actual creature portrait and every supplied ability image, including variants that might change interpretation. For Google Drive sources, use the connected Drive tools and their skill to find and inspect image bytes; use preserved local originals when available. Record file IDs/links or local paths and which variant was inspected. A filename, prompt or text description is not evidence of what an image depicts. If access is missing, state which observations and options remain provisional; continue only work that does not depend on that image.

Write a short visual brief that separates observation from interpretation:

| Observe                                            | Derive possible mechanics from it                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| Anatomy, silhouette, posture, scale and expression | How it moves, protects, threatens or supports                                     |
| Materials, props, habitat and other figures        | Resources, relationships, vulnerabilities and thematic verbs                      |
| Palette, light, rendering style, mood and motion   | Tempo and emotional character: patient, volatile, playful, mournful, communal     |
| The action and recipients in each ability image    | Offensive, defensive, restorative, movement or utility role and plausible targets |

Describe two or three possible mechanical identities in plain language, such as patient accumulation or trading protection for tempo. Treat these as interpretations, not facts supplied by the artist. Avoid deriving a damage type solely from color. Fauna has no elemental matchup chart or implied reactions; use [actual keyword rules](KEYWORDS.md).

Keep each ability's primary effect faithful to its image. A shield image should primarily protect; an attack image should threaten; an image of sheltering several creatures may support a group effect. A secondary effect should reinforce that reading. Do not force an attack/defense/heal formula onto three images that suggest another coherent kit. When art and a desired mechanic disagree, propose the tradeoff or a separately scoped art revision instead of silently repurposing the image.

Use [art direction](../.agents/skills/fauna-art-direction/SKILL.md) for source selection or changes. Preserve originals, provenance and rights notes; use creature 4:3 and action 3:4 compositions. Check legibility at real ArtCard sizes as well as in the source.

## 2. Find a distinct place in the roster

Review the **current** catalog in [creature kits](../src/game/content/creatures.ts), its individual kit files and relevant [talents](../src/game/content/talents.ts) and [Boons](../src/game/content/boons.ts). Read effect consumers when a description leaves timing or scope unclear. Include implemented passives and any pending design notes visible in the task's available repository; do not inspect other chats for routine coordination.

For each candidate, compare this mechanical signature with existing designs:

- Trigger and frequency: what causes it, whose actions count and how often it pays
- Recipient and scope: self, teammate, whole deployed side, opponents or summons
- Timing and conversion: before/after damage, on actual Health restored, on card play, resource spent or threshold crossed
- Outcome and limits: what changes, how long it lasts, what caps it and whether it chains
- Strategic decision: what the player does differently in drafting, card order, targeting, defense or swaps

A new name, damage color, amount, second trigger count or rearranged wording alone is insufficient for a new passive identity. Name the closest existing passives and explain the material difference. If the best idea is already occupied, explore another thematic verb before adding exceptions. The goal is strategic variety with understandable rules, not a new keyword for every creature.

For example, the current roster already includes Rookhaven's draw-copying, Wickwaltz's second-card repeats and Cadenza's second-card healing. A proposal about playing a second card must explain a substantially different decision beyond another automatic payout. Ability overlap also exists: Dunefox and Glintstride both have Dodge plus draw. These are comparison examples to recheck, not permission to copy or an instruction to redesign them.

## 3. Propose passive choices

Normally present three options with different play patterns, not three values for one effect. For each include:

| Field                            | What the proposal should establish                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| Trait name and concise base rule | A player-readable effect with no periods; use semicolons for clauses                  |
| Artwork connection               | Which observed features support this behavior                                         |
| Strategic identity               | What decision changes, including one example turn or drafting choice                  |
| Novelty comparison               | Closest existing passive(s) and why this differs from all current ones                |
| Six-tier sketch                  | A plausible progression through zero to five stars without changing its core identity |
| Constraints and counterplay      | Trigger scope, timing, limits, weak situations and opponent response                  |
| Implementation reach             | Existing effect composition or a new rule; important consumers and saved-state needs  |

Prefer a passive that works through general gameplay concepts over one that only buffs its three named abilities. It should matter at zero stars, invite synergies without requiring one specific partner or rare Boon, and leave room for opponents to respond. Explain team-wide benefits and duplicate-species stacking. Do not make the signature decision exist only at the final tier.

All six tiers must have different gameplay effects. Each replaces the complete previous tier. For the selected option, write the full rules and effects at every tier; confirm caps, rounding and limits do not make adjacent tiers functionally identical. Scaling values or probabilities is usually enough. Do not add six unrelated mechanics merely to satisfy the tier requirement. Enemies use the base tier; player ranks and ability upgrades are separate progression axes.

During comparison, a shared rule plus six explicit amounts/chances is enough for a tier sketch. Use concise timing notes for proposed options; expand the selected design's full semantics before implementation rather than repeating six paragraphs for every candidate.

Before implementation, settle ambiguous trigger semantics: attempts versus actual outcomes; card versus repeated effect; owner versus all allies; direct, periodic, reflected and derived damage; dead or controlled actors; multiple simultaneous recipients; whether a benefit can trigger itself. State duration, reset points and stacking. Keep player rules short while making these semantics precise in the design notes and gameplay tests.

## 4. Propose options for every ability image

Offer two or three mechanics for **each** of the three ability illustrations, unless another amount is requested. Display the source or a usable source reference beside the options so choices remain tied to the image. Each option needs a name, concise rules, target and timing, artwork rationale, budget assumptions, nearest existing abilities and its role with the passive candidates.

Compare full effect behavior, including extras, not just the primary effect name. Avoid exact duplicates where the artwork supports a meaningful alternative. A changed number alone rarely creates a new tactical role. Simple attacks or shields can still be appropriate: flag intentional overlap, explain why it serves this kit and seek distinctiveness through a coherent interaction rather than bolting on unrelated utility. Never assert roster-wide uniqueness from a few remembered examples.

Check the whole kit together. Describe a normal opening, a satisfying sequence, a weak draw and a losing situation; identify which passive/ability combinations reinforce each other and which conflict. Every ability should have a useful situation without one choice always dominating. A support creature need not attack, but must contribute without a perfect hand or partner; check starter eligibility rather than automatically adding it to the first-run pool.

### Ability budgets

Every authored ability costs exactly **1 Mana**, including generated cards. Most base abilities should begin near a six-point budget before upgrades, passive amplification and talents. These are starting comparisons:

| Baseline                           | Initial estimate              | Qualification                                                         |
| ---------------------------------- | ----------------------------- | --------------------------------------------------------------------- |
| 6 direct damage to one target      | About 6                       | Damage type and added status value matter                             |
| 6 Block or 6 healing to one target | About 6                       | Block decays; healing caps at missing Health and cannot revive        |
| 2 damage to all enemies            | About 6 against three enemies | Fewer enemies reduce output; Minions can raise it                     |
| 2 Block or healing to all allies   | About 6 with three recipients | Solo/Legendary formations, injured recipients and Minions alter value |
| 3 direct damage plus 3 Block       | About 6 before interactions   | Check the actual recipient, order and passive triggers                |

This is not a claim that all damage types, Armor, healing and control exchange one-for-one. Show the arithmetic for simple quantities and explain uncertainty for utility. Evaluate common boards and high-output cases separately; do not assume every group effect always hits three creatures.

For utility, compare current abilities with similar timing and restrictions and give a provisional valuation or range with reasons. Avoid a permanent universal price table until playtests support one. Explain what was reduced to pay for utility and why an exception exceeds or falls below six:

- **Draw, recovery and generation:** immediate versus delayed access, selection versus randomness, reshuffle timing, six-card hand and persistent overflow, card ownership and whether generated cards remain in the battle deck
- **Mana and cost modifiers:** net Mana after the 1 Mana cost, turn maximum, opportunities to play more cards, generated-card triggers and loop potential; one Mana is not one damage point
- **Armor, Thorns, Dodge and other protection:** duration, multiple prevented/retaliated hits, caps, mitigation order and the difference between guaranteed and probabilistic defense
- **Statuses and removal:** damage now plus later ticks, crowd-control thresholds/immunity, count of effects removed, likely targets and how often there is a valid payoff
- **Random, conditional, repeating and area effects:** expected output, ceiling, reliability, targeting flexibility and trigger multiplication; a condition already guaranteed by the passive is not a meaningful discount
- **Swaps or other tempo effects:** resource and targeting implications, backup availability, card-zone changes, benefit to incoming creatures and the failure case

Do not attach draw, Mana, control or lasting defense for free to an already complete six-point effect. Estimate the card alone, then the kit at base rank and high rank/upgrade levels, then strong talent/Boon/duplicate-creature combinations. The normal upgrade calculation starts from base value plus two per level, but effect consumers decide how that value is used; fixed extras and effect counts may not upgrade. Verify displayed and executed scaling instead of assuming every field increases.

Confirm that a proposed payoff can actually occur before assigning it value. For example, ordinary turn start refills Mana to its maximum: a delayed Mana grant after that refill is capped away, while one before the reset may be overwritten. A useful next-turn resource effect needs explicit timing and, if intended, an explicit maximum-Mana rule; do not count an ineffective grant as utility. Apply the same check to full-Health healing, status caps and counters that reset before their trigger.

Use paper examples to reject obvious outliers and loops; use focused gameplay evidence to tune the rest. A six-point estimate is not evidence of balanced win rate. Do not run full balance simulations locally without the authorization required by [verification policy](../CONTRIBUTING.md#verification).

## 5. Present a design packet and resolve choices

Keep the first proposal compact and comparable:

1. Visual brief with the portrait and three ability sources, observations and proposed identity
2. Passive option table with strategic differences, nearest overlaps and six-tier sketches
3. Separate option table for each ability image, including approximate budget and tradeoffs
4. Recommended combination, example play sequence, weakness/counterplay and alternatives that work with another passive
5. Proposed Health and its durability rationale, progression/encounter role, new mechanics, implementation reach and unresolved choices

For a design-options request, present this packet before implementing a chosen kit. Use a choice already made or an explicit request to choose and implement; do not create repeated permission steps. If only part of the art set exists, identify the missing slots without inventing unseen images. Keep unsupported rule changes clearly proposed. Preserve final decisions in a creature reference under [the creature index](content/creatures/README.md), with provenance and validation evidence separate from the kit rules.

## Boss and Legendary creatures

Read [Legendaries and Minions](EXPEDITION_DESIGN.md#legendaries-and-minions), [Memento's reference](content/creatures/memento.md), its [authored kit](../src/game/content/creatures/memento.ts), [Legendary execution](../src/game/combat/legendary.ts) and [encounter definitions](../src/game/encounters.ts). Recheck the current code when using this example; initial numbers and Memento-specific behavior are not universal boss requirements.

### What Memento demonstrates

The inspected portrait depicts a vast, submerged octopus/palace among ruins, coral and warm lit arches. Memory, a vanished court and lingering inhabitants are interpretations that support its kit. The Court Remembers turns each accepted card into one random living, uncontrolled Echo's Water attack against a random living opponent. Its six tiers deal 1 through 6 damage. The hook runs after card effects, so a newly summoned Echo can attack immediately; repeats do not count as additional plays.

Lost Procession summons an Echo into either of two spaces, or fully heals living Minions at capacity. Echoes begin with 6 Health, with two more per ability level. Treasury Echo creates two Pearls; Drowned Revelation draws two cards. Each Pearl costs 1 Mana and grants 2 Block or Mana with equal probability, respecting the Mana cap. Pearls enter hand/overflow and keep cycling until battle ends or their owner leaves the field. Those cards extend the engine and trigger the court, so their value cannot be assessed from printed damage alone.

Memento currently has 60 base Health and fills both Boss encounters. The reusable lesson is an integrated engine with a recognizable setup, payoff and disruption point. Its two-Echo limit, Pearls, Health and summon-heal fallback are kit-specific tuning. New bosses need not summon, generate cards, or copy that loop.

### Shared rules a new Legendary must support

| Contract                                                                                 | Design implication                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| One Legendary deployed alone; up to four backup within the five-creature roster          | Its kit must function without ordinary deployed teammates; evaluate group abilities on this formation                                             |
| Two copies of each of three authored abilities                                           | Evaluate a six-card core deck and repeated access; generated cards are additional definitions, not a fourth permanent ability                     |
| Boss enemies also use a deck, four Mana, four draws and the six-card hand/overflow rules | A draw/resource engine needs meaningful automatic enemy decisions and a bounded fallback                                                          |
| Boss encounters at 4 and 8 begin with one Legendary                                      | Check both room scales, not just base stats; current enemy Health/damage/heal/Block scale by 1.3 and 1.7 respectively, with documented exceptions |
| Bosses can be recruited and later selected as solo starters                              | Preserve the core identity on both sides and through recruitment, Collection, rank progression and swaps                                          |
| Minions have Health/effects, no cards, roster slots, autonomous turns or Death's Door    | Define ownership, targeting and cleanup; defeating the enemy Legendary wins even if Minions remain                                                |

Ordinary enemies do not have the boss deck model. In particular, current [enemy card rules](../src/game/card-rules.ts) allow primary draw for Memento by species, and [boss card priority](../src/game/combat/legendary.ts) knows its Echo/Pearl engine. Setting `legendary: true` alone does not establish support for another engine. Audit these consumers and adapt the owning rules for the selected kit without silently inheriting Memento's assumptions.

### Additional boss design questions

- **Encounter identity:** What tactical problem does this boss pose beyond larger Health/damage? Show setup, pressure, payoff, at least one accessible response and recovery after that response. Avoid a single required creature or keyword counter
- **Understandable threat:** Enemy intents remain hidden in Fauna. Communicate the engine through artwork, rules, visible state and committed outcomes. Propose new visible state if a mechanic needs it; do not depend on an unimplemented intent display or surprise exceptions
- **Solo viability and pacing:** Can it start its engine from a poor opening draw? Can the opponent interrupt it without making the fight inert? Is there a route to victory without endless healing, control locks or obligatory extra phases?
- **Recruitable form:** Is the same identity fun to play and fair to face at base enemy tier and all six player tiers? Account for solo formation, swaps, automatic enemy priorities and any explicitly proposed asymmetry; do not hide a boss-only replacement kit
- **Budget of the engine:** Keep 1 Mana costs; estimate the full turn/cycle, setup costs, payoff frequency, generated-card dilution and worst-case loops. Legendary status is not blanket permission to inflate each card beyond six points; justify exceptions as part of the complete solo kit
- **Lifetime and bounds:** Specify generated card/Minion limits, recursion suppression, ownership on death/swap, zone overflow and save/resume. Current battles cap at 256 cards and enemy auto-play at 256 decisions per turn; those bounds protect execution rather than establish good pacing

Phases, additional resources, new summon types or alternate victory conditions are possible proposals, not existing shared requirements. Explain their rules, presentation and implementation cost before adopting them.

## Implementation and validation

After a kit is chosen or selection is delegated, implement it through the current owners rather than leaving design-only notes:

1. **Definitions and integration:** Add stats, complete passive tiers and exactly three unique ability definitions to the creature kit. Update species types, explicit species/card catalogs, intended ordinary encounter packs or Boss definitions and relevant fixtures. Preserve intentional seeded catalog order. Review first-run starter eligibility and later collected-species drafts rather than adding every species indiscriminately
2. **Rules and runtime:** Extend typed effects and the consumers that actually own the behavior: [ability execution](../src/game/combat/abilities.ts), [values](../src/game/combat/ability-values.ts), [combat hooks](../src/game/combat/index.ts), [descriptions/enemy adaptation](../src/game/card-rules.ts), [passive progression](../src/game/progression.ts) and [keyword classification](../src/game/keywords.ts) as applicable. Keep previews and execution consistent; update glossary/talent/XP treatment only when the mechanic warrants it
3. **Ownership and persistence:** Keep I/O and ambient randomness outside gameplay; consume seeded RNG only for accepted commands. Define new counters' owners and reset boundaries. Update current save validation/schema/fixtures together when adding state, following the disposable-development-save policy rather than adding migrations. Keep saving and settlement in application/command owners, independent of animation
4. **Assets and reference:** Register stable artwork IDs and provenance in the manifest, preserve originals, prepare derivatives through the existing pipeline when assets change, and update the creature reference/index. Do not hand-edit generated lookup data. Follow the source/output checks in [prepared assets](CONTENT.md#prepared-assets)
5. **Focused regressions:** Test the selected mechanic's actual payoff and timing, no-trigger boundaries, all six tier distinctions, caps/stacking and rejected-command RNG preservation where relevant. Add coverage for repeats/derived effects, enemy use, save/resume and death/swap cleanup when affected. For bosses include the opening engine, bounded generation/overflow, formation changes, victory, recruitment and solo starter flow. Reuse existing tests, including [Memento regressions](../tests/unit/game/creatures/memento.test.ts), as evidence of contracts rather than copying its implementation
6. **Rendered review:** Inspect the new creature, trait tiers and all three abilities in Collection/inspection and battle, plus affected targeting, summons or generated cards. Review source/prepared art together, readable rules, feedback under mute and fit at 1280×720 or larger under [required UI review](UI.md#required-review). Follow the art/UI skills for changed presentation; retain before/after evidence. A catalog-only test cannot establish image suitability or a usable interaction
7. **Tuning and handoff:** Check base rank and advanced tiers/upgrades, one/three opponents, injured/full-Health allies, duplicate creatures and strong talent/Boon combinations where relevant. Run task-scoped checks and focused suites under [verification policy](../CONTRIBUTING.md#verification); documentation edits also require the documentation gate. Review and integrate through the protected workflow only with the required evidence. Report design decisions, remaining preference choices, observed tests/rendering and balance limitations; full CI, desktop, Windows packaging, physical controller, Steam and Steam Deck claims require their own observed evidence

For design-only requests, deliver the options and concrete validation plan without changing gameplay. For implementation requests, the done state includes the selected kit, matching rules and provenance, focused behavior evidence and required rendered review; distinguish that from user artistic acceptance and measured balance.
