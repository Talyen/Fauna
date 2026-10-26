# Reverie

Use the [authored kit](../../../src/game/content/creatures/reverie.ts) for current values and complete tiers; [recorded selection values](../../archive/CREATURE_KIT_SELECTIONS.md#reverie) preserve historical tuning.

Reverie is an ordinary support creature, titled “The sanctuary of dreams”
The user selected this kit on October 23, 2026

All three cost 1 Mana. Unhurried restores rank-dependent Health at turn end to allies that played no cards

## Identity and resolution

The portrait shows a moss-green, leaf-coated sloth sleeping across a flowering branch above a moonlit rainforest pool. Its long relaxed arms, warm face and broad pink blossoms establish a sheltered, unhurried mood. The selected ability images show a revealed waterfall stairway, a glowing double drawing thorns away from a sleeping body, and a dark cloud transformed into golden sparks

- Unhurried resolves at the end of each side’s turn, before the opposing side begins. Each living deployed Reverie independently heals every living deployed ally that played no cards that turn, including itself. Reserves and knockouts neither provide nor receive the aura. Support cards count as activity; repeated effects count as one accepted play, and retaliation is not a card play. Activity follows the creature through swaps and saves and resets at its next turn start. Ordinary enemies use the base tier. Minions are deployed allies and may receive healing
- Healing uses ordinary maximum Health, healing modifiers and healing rewards. It is passive healing, so it does not grant card XP or card-only overheal rewards. Unlike Cadenza’s second-card trigger or Neradora’s every-other-turn self-heal, Unhurried rewards leaving specific creatures idle. An active Reverie can still heal resting partners, and a resting Reverie can heal itself while teammates act
- Waking Wonder uses ordinary draw, discard recycling, six-card hand, overflow and Well Read ownership. Its starting draw of two rises by two per ability level, matching existing draw upgrades
- Dream Double grants Nature Thorns and one non-stacking Negate protection. Thorns increase by two per ability level; protection remains one attack. Protection lasts until consumed, Purged or combat cleanup and survives swaps and resume. A Blind miss does not consume it; otherwise it resolves after interception and before Dodge, Block or Armor. A protected recipient takes none of that attack’s primary or authored supplemental damage, Blind, Purge or Armor removal. Other recipients of an area attack still resolve normally. A repeat is another attack and may connect after protection is consumed
- Negation still triggers the recipient’s existing Nature, Water and Fire Thorns once, using their usual damage, one-stack decay and non-recursive retaliation rules. Negation itself neither Dodges nor grants Dodge rewards. Periodic, proc, resonance and retaliation packets do not independently consume protection. An ability’s Light bounce can consume it on its own recipient. Actor-owned support benefits still resolve if the actor survives
- Nightmare Harvest removes all harmful effects from living deployed allies through the shared Cleanse owner, including active control and Blind. Each distinct removed category on each recipient grants one shared Mana, capped at the shared Mana capacity, including Rainkeeper’s overflow allowance; stack amounts do not multiply the payout. An empty Cleanse grants none. Existing Cleanse rewards still apply. The Mana rate remains one through upgrades and room scaling. Repeats recheck the remaining effects. Ordinary enemies Cleanse their own side without granting player Mana; an enemy with a deck receives its own capped Mana

## Availability and balance

Reverie is appended to the explicit species and card catalogs and two ordinary encounter packs. It is recruitable and available in subsequent collected-species drafts. The first-run starter pool is unchanged: the kit has reactive Thorns but no proactive attack

A normal turn shields Reverie with Dream Double, draws teammates’ options with Waking Wonder, and leaves injured allies idle when their healing is worth more than their card. A strong sequence protects against a hit, retaliates, then uses Nightmare Harvest to remove several allied afflictions and recover spending capacity. A weak hand contains Harvest without harmful effects or draw without useful follow-ups. Status-free opponents that avoid Reverie can deny Harvest’s payout and Thorns pressure; multi-hit/repeated attacks exhaust one protection

Dream Double and Harvest deliberately exceed a simple six-point estimate in favorable matchups: negation has no damage ceiling and Harvest can remove several categories and refill Mana. Their value is conditional, protection does not stack, and Mana cannot exceed the existing cap. Advanced Unhurried and duplicate Reveries can produce substantial healing when several creatures rest. Grove’s Favor rewards that healing; Cleanse rewards and Arcane Mending can amplify Harvest. These are user-selected rules and provisional balance observations, not measured win-rate acceptance

## Artwork

Unchanged selected originals from the user’s [Reverie folder](https://drive.google.com/drive/folders/12zuk45o-vMtvj-FgrhjV20BxyH7SOHpM) are preserved under `public/art/reverie/` and registered in the prepared-asset manifest

| Selection         | Drive original                                                                              | Visible connection                            |
| ----------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Portrait          | [Reverie 05](https://drive.google.com/file/d/1N1s0Hjwre_678myVTqBJL8gaq0ZjO6re/view)        | Resting sloth, moonlight, sheltering branches |
| Waking Wonder     | [Waking Wonder](https://drive.google.com/file/d/10tWq1tD4xMTdDSH-SIyCA-4FqHgIvzJb/view)     | Opening mist reveals new possibilities        |
| Dream Double      | [Dream Double](https://drive.google.com/file/d/19Yw-AvCXWvPxVK2Ol80iNAVuj_l2txAt/view)      | Dream body takes danger away from the sleeper |
| Nightmare Harvest | [Nightmare Harvest](https://drive.google.com/file/d/1a-GcsGV1azUwAPpjml_21Pp7ZTYYZMrZ/view) | Harmful cloud becomes useful light            |

The other ability illustrations are not part of the implemented kit. The lossless card recipe preserves the selected compositions at runtime sizes; source inspection and rendered review remain separate from artistic and balance acceptance

## Implementation review

Chromium review on October 23, 2026 inspected Collection, all three ability illustrations and rules, base/five-star passives and battle at 1280×720 with 125% text and 1920×1080 with default text. Main captures used 2× device density and reduced motion. The complete composition, native artwork ratios, readable keyword colors, control reachability and effect icons were inspected; all captured layout assertions passed

The browser flow played Dream Double, Nightmare Harvest and Waking Wonder, checked committed protection/Thorns, group removal and capped Mana, then advanced the turn and confirmed protection consumption and idle allies’ healing. Local evidence remains in the retained task checkout at `reports/reverie/evidence.json`, with frames and the initial checkpoint beside it. `reports/review/reverie-before-bc57f92f-a0ec-4f26-a4c2-a909ff806f23/` retains the pre-edit inspection layout

This is focused browser evidence, not measured balance or native desktop, Windows packaging, physical controller, Steam client or Steam Deck qualification. The user selected the kit and source artwork; the rendered composition has not received separate artistic approval
