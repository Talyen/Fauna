# Creature design

A creature's artwork, passive and three abilities should express one identity and give the player a distinct strategic choice. Use the [creature design skill](../.agents/skills/fauna-creature-design/SKILL.md); [Content](CONTENT.md) owns authoring contracts and [Journey design](EXPEDITION_DESIGN.md) owns encounters, deployment and recruitment.

## Start with the artwork

Inspect the actual portrait and every ability illustration through connected Google Drive tools or preserved local originals. Record source links/IDs or paths and selected variants. Filenames and prompts cannot replace looking at the images; keep dependent proposals provisional when essential art is inaccessible.

Describe the silhouette, posture, materials, habitat, palette, style, mood and depicted actions. Separate visible observations from interpretations, then choose a strategic identity supported by them.

Keep mechanics faithful to the action: shields protect, attacks threaten, restoration restores. Secondary effects should reinforce that reading. Avoid forcing every kit into attack/defense/heal roles or choosing damage types solely from color. Use Fauna's [actual keyword rules](KEYWORDS.md), which have no elemental matchup chart.

## Design a distinct passive

Read all current [creature kits](../src/game/content/creatures.ts) and relevant [talents](../src/game/content/talents.ts) and [Boons](../src/game/content/boons.ts). Compare triggers, targets, timing, outcomes, resources and limits; inspect execution when wording leaves these unclear. Each candidate must differ mechanically from every current passive. Explain the nearest overlaps and the new decision it creates; a changed name, amount or damage type alone is insufficient.

Recommend one passive as part of the complete kit. Provide:

- A trait name and concise base rule, with no periods in effect text
- The artwork connection and the choice it creates in drafting, sequencing, targeting or swaps
- Its difference from existing passives, useful synergies and a weakness or counterplay
- All six complete tiers and any new mechanic needed

Prefer general gameplay interactions over bonuses to named abilities. The passive should matter at zero stars and work without one mandatory partner or rare Boon. Check duplicate-species stacking and avoid extra keywords or exceptions that add complexity without a better decision.

All six tiers must have different gameplay effects; each replaces the complete previous tier. A shared rule plus six amounts/chances is enough for comparison. Fully specify the selected tiers before implementation, checking caps and rounding for ineffective upgrades. Enemies use the base tier; player rank and ability upgrades are separate progression axes.

## Design abilities from their images

Recommend one ability per illustration, including name, concise rules, target/timing, artwork rationale, approximate budget, nearest existing effects and tradeoff. Offer alternatives when requested or when a consequential unresolved choice materially changes the kit.

Compare complete behavior, including extras. Avoid exact overlap where the art supports a meaningful alternative; explain intentional overlap when a simple attack or shield serves the kit best. Do not attach unrelated utility just to make a card different.

Evaluate the abilities together with the passive. Every ability needs a useful situation, and the kit should contribute through poor draws as well as ideal sequences. Support creatures need not attack; check starter eligibility rather than adding every kit to the first-run pool.

### Ability budgets

Every authored ability costs exactly **1 Mana**, including generated cards. Most base abilities start near **six points** before upgrades and passive/talent amplification:

| Baseline                                 | Starting estimate             |
| ---------------------------------------- | ----------------------------- |
| 6 damage, Block or healing to one target | About 6                       |
| 2 damage to all enemies                  | About 6 against three enemies |
| 2 Block or healing to all allies         | About 6 with three recipients |
| 3 direct damage plus 3 Block             | About 6 before interactions   |

This is a flexible guideline: explain meaningful deviations. Damage types, lasting defense and control are not interchangeable. Group value changes with living targets, missing Health, solo formations and Minions.

For utility, use comparable current abilities to give a provisional valuation or range with reasons. Account for:

- **Draw, recovery and generation:** immediate access, selection, recycling, hand/overflow limits and generated-card lifetime
- **Mana and tempo:** net gain after the card's cost, caps, extra plays, swaps and potential loops
- **Defense, statuses and removal:** duration, repeated prevention/retaliation, later damage, control thresholds and valid targets
- **Randomness and conditions:** expected output, ceiling, reliability and whether the passive already guarantees the condition

Pay for utility by reducing other effects; a complete six-point effect does not get free draw or Mana. Confirm the payoff can occur: next-turn Mana may be erased by the reset or capped away by the normal refill. Check full-Health healing, status caps and counter resets similarly.

Estimate the card alone, the complete kit at base and advanced progression, and strong talent/Boon/duplicate-creature combinations. Verify actual upgrade behavior: primary values commonly gain two per level, while fixed extras and effect counts may not. Point estimates guide tuning; they do not establish balanced win rates.

## Present the kit

Present one coherent kit with its artwork rationale, proposed Health, six passive tiers, three abilities, a normal opening, a satisfying sequence, a weak draw and a losing situation. Explain nearest overlaps and meaningful budget deviations. Include alternatives only where they help resolve a consequential choice or the user requests exploration.

A request to implement authorizes choosing routine details and proceeding with the recommended kit. A request for design advice calls for a proposal. Ask only about consequential ambiguity that the request and project contracts cannot resolve. Keep proposed rule changes distinct from existing mechanics.

## Boss and Legendary creatures

Use [Legendaries and Minions](EXPEDITION_DESIGN.md#legendaries-and-minions) and [Memento](content/creatures/memento.md) as the current reference, rechecking its [kit](../src/game/content/creatures/memento.ts) and [execution](../src/game/combat/legendary.ts).

### Memento's lesson

The submerged octopus/palace suggests a vanished court and lingering inhabitants. Its kit makes that interpretation playable: summon Echoes, create and cycle Pearls, and draw more cards; The Court Remembers turns each accepted card into one Echo attack. The hook runs after effects, so a new Echo can attack immediately; repeats do not count as additional plays.

The identity comes from the complete setup/payoff loop, not printed damage. Borrow that coherence, rather than its specific summons, resources or tuning. Other bosses can pose entirely different strategic problems.

### Design for both sides

- **Solo formation:** One Legendary deploys alone, with up to four backup in the five-creature roster; its kit must work without ordinary deployed teammates
- **Deck and resources:** Two copies of each of three abilities form the six-card core; Boss enemies use four Mana, four draws and the six-card hand with persistent overflow
- **Encounter and recruitment:** Boss encounters 4 and 8 begin with one Legendary; test both room scales, recruitment, solo starter play and all player passive tiers
- **Minions, if used:** They have Health/effects but no cards, roster slots, autonomous turns or Death's Door; they leave when their summoner falls or departs, and defeating the enemy Legendary wins even if Minions remain

Give the boss recognizable setup, pressure, payoff and an accessible response without requiring one counter species. Test poor openings, recovery after interruption and fight length. Avoid endless healing, control locks and runaway resource engines. Enemy intents remain hidden: communicate threats through rules, visible state and outcomes.

Preserve the core identity when recruited. Assess the full turn/cycle and justify budget exceptions as part of the solo kit; Legendary status does not make every card stronger by default. Treat phases, new resources or alternate victory rules as explicit proposals with presentation and implementation costs.

Audit enemy support rather than assuming `legendary: true` enables a new engine: current [enemy card rules](../src/game/card-rules.ts) allow primary draw specifically for Memento, and [boss priorities](../src/game/combat/legendary.ts) know its Echo/Pearl loop. Define generation limits, ownership, cleanup and save/resume. Existing 256-card and enemy-decision bounds protect execution, not pacing.

## Implementation and validation

Once selected, implement through the existing owners:

1. **Author the kit:** Stats, six complete passive tiers, three unique ability definitions, species types, explicit catalogs and intended encounter/starter integration. Preserve seeded catalog order
2. **Keep rules aligned:** Complete the [ability rule and execution contracts](ARCHITECTURE.md#ability-rules), plus passive consumers and keyword/XP treatment as needed. Existing card/value queries consume these policies. Define trigger order, actual outcomes versus attempts, repeats/derived effects, stacking, recursion limits and reset points
3. **Own state and assets:** Keep gameplay deterministic and rejected commands state/RNG-preserving. Update save schemas/validation/fixtures together for new state, following the development-save policy. Preserve source art/provenance and use the [prepared-asset pipeline](CONTENT.md#prepared-assets); document decisions in the [creature reference index](content/creatures/README.md)
4. **Protect behavior:** Add focused regressions for payoffs and no-trigger cases, tiers, caps, enemy use and affected save/resume or death/swap boundaries. Boss coverage also includes engine startup, generation/overflow, formations, victory and recruitment; [Memento's tests](../tests/unit/game/creatures/memento.test.ts) illustrate these contracts
5. **Review in play:** Inspect art, rules, tiers, targeting and feedback in Collection/inspection and battle at the [required viewport/input conditions](UI.md#required-review). Follow the single [UI task procedure](UI.md#required-review); use [art direction](../.agents/skills/fauna-art-direction/SKILL.md) when producing assets

Follow the repository's [verification and integration policy](../CONTRIBUTING.md#verification). Report observed checks, rendered evidence, balance limitations and unresolved choices separately. Implementation, artistic acceptance, measured balance and full CI/platform verification are distinct outcomes.
