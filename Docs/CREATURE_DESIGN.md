# Creature design

A creature's artwork, passive and three abilities should express one identity and give the player a distinct strategic choice. Use the [creature design skill](../.agents/skills/fauna-creature-design/SKILL.md); [Content](CONTENT.md) owns authoring contracts and [Journey design](EXPEDITION_DESIGN.md) owns encounters, deployment and recruitment.

## Elegant abilities and passives

Design mechanics that are elegant, thematic and immediately understandable at a glance. Start with one relationship suggested by the artwork: what the creature does, what changes and who benefits. Prefer a short, literal rule using familiar game terms. "Light damage bounces once" and "Give an ally 6 Block" communicate their effects directly; poetic names should not make the rules harder to understand.

Avoid building concepts around card taxonomy, phase bookkeeping, trigger quotas or accumulated exceptions. Phrases such as "non-attack ability", "first time each turn", "until your next turn", "at the end of your turn" and "at the beginning of your turn" are signs to reconsider the design. Changing them to "support action", "once per round" or another shorthand does not remove the underlying complexity. A natural interaction such as Dodging, restoring Health or breaking Block usually gives a clearer foundation than tracking which numbered card was played in a particular window.

This is a mechanic-design preference, not just a copy edit. If an effect needs a chain of qualifiers to stay fair, try a smaller value, a more focused thematic relationship or a different effect. Do not retain a complicated engine underneath a misleadingly simple sentence. Keep any restriction essential to the player's decision visible; when that makes the rule unwieldy, redesign it. Use an established keyword when its actual meaning fits, rather than inventing a keyword to conceal bookkeeping.

Keep exact resolution order, tie-breaks and technical safeguards in design or implementation notes when they do not change what the player reasonably expects. Explain material balance concerns separately from the proposed effect text. Necessary timing can remain when it is the central, intuitive idea, but should not become a default balancing device attached to every proposal.

Apply this standard to brainstorming alternatives as well as the selected kit. Distinctiveness should come from the core interaction, not a familiar effect decorated with conditions. Scale passive strength across all six tiers by changing clear values where possible, preserving the same understandable rule. Before presenting a candidate, check whether the player can predict its effect from one reading and whether its strategic choice survives removing unnecessary restrictions. Replace candidates that fail instead of filling a requested option count with wordy variants.

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

Prefer general gameplay interactions over bonuses to named abilities. The passive should matter at zero stars and work without one mandatory partner or rare Boon. Check repeated triggers and Talent/Boon stacking within the one-individual-per-species roster, and avoid extra keywords or exceptions that add complexity without a better decision.

All six tiers must have different gameplay effects; each replaces the complete previous tier. A shared rule plus six amounts/chances is enough for comparison. Fully specify the selected tiers before implementation, checking caps and rounding for ineffective upgrades. Enemies use the base tier; player rank and ability upgrades are separate progression axes.

## Design abilities from their images

Recommend one ability per illustration, including name, exact concise effect text, artwork rationale, approximate budget, nearest existing effects and tradeoff. Explain necessary targeting and timing separately without hiding restrictions the player needs to know. Offer alternatives when requested or when a consequential unresolved choice materially changes the kit.

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

Estimate the card alone, the complete kit at base and advanced progression, and strong talent/Boon combinations within valid rosters. Verify actual upgrade behavior: primary values commonly gain two per level, while fixed extras and effect counts may not. Point estimates guide tuning; they do not establish balanced win rates.

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
- **Encounter and recruitment:** Boss rooms 10, 20 and 30 begin with one Legendary; test all three room scales, recruitment, solo starter play and all player passive tiers
- **Minions, if used:** They have Health/effects but no cards, roster slots, autonomous turns or Death's Door; they leave when their summoner falls or departs, and defeating the enemy Legendary wins even if Minions remain

Give the boss recognizable setup, pressure, payoff and an accessible response without requiring one counter species. Test poor openings, recovery after interruption and fight length. Avoid endless healing, control locks and runaway resource engines. Enemy intents remain hidden: communicate threats through rules, visible state and outcomes.

Preserve the core identity when recruited. Assess the full turn/cycle and justify budget exceptions as part of the solo kit; Legendary status does not make every card stronger by default. Treat phases, new resources or alternate victory rules as explicit proposals with presentation and implementation costs.

Audit enemy support rather than assuming `legendary: true` enables a new engine: current [enemy card rules](../src/game/card-rules.ts) allow primary draw specifically for Memento, and the shared [enemy evaluator](../src/game/combat/enemy-policy.ts) values immediate outcomes, including Memento’s post-card Echo attacks. [Legendary execution](../src/game/combat/legendary.ts) owns its deck, Pearls and Echoes. Define generation limits, ownership, cleanup and save/resume. Existing 256-card and enemy-decision bounds protect execution, not pacing.

## Implementation and validation

Once selected, implement through the existing owners:

1. **Author the kit:** Stats, six complete passive tiers, three unique ability definitions, species types, explicit catalogs and intended encounter/starter integration. Preserve seeded catalog order
2. **Keep rules aligned:** Complete the [ability rule and execution contracts](ARCHITECTURE.md#ability-rules), plus passive consumers and keyword/XP treatment as needed. Existing card/value queries consume these policies. Define trigger order, actual outcomes versus attempts, repeats/derived effects, stacking, recursion limits and reset points
3. **Own state and assets:** Keep gameplay deterministic and rejected commands state/RNG-preserving. Update save schemas/validation/fixtures together for new state, following the development-save policy. Preserve source art/provenance and use the [prepared-asset pipeline](CONTENT.md#prepared-assets); document decisions in the [creature reference index](content/creatures/README.md)
4. **Protect behavior:** Add focused regressions for payoffs and no-trigger cases, tiers, caps, enemy use and affected save/resume or death/swap boundaries. Boss coverage also includes engine startup, generation/overflow, formations, victory and recruitment; [Memento's tests](../tests/unit/game/creatures/memento.test.ts) illustrate these contracts
5. **Review in play:** Inspect art, rules, tiers, targeting and feedback in Collection/inspection and battle at the [required viewport/input conditions](UI.md#required-review). Follow the single [UI task procedure](UI.md#required-review); use [art direction](../.agents/skills/fauna-art-direction/SKILL.md) when producing assets

Follow the repository's [verification and integration policy](../CONTRIBUTING.md#verification). Report observed checks, rendered evidence, balance limitations and unresolved choices separately. Implementation, artistic acceptance, measured balance and full CI/platform verification are distinct outcomes.
