# Reverie

Use the [authored kit](../../../src/game/content/creatures/reverie.ts) for current values and complete tiers.

Reverie is an ordinary support creature, titled “The sanctuary of dreams”

All three abilities cost 1 Mana. Unhurried restores rank-dependent Health at turn end to allies that played no cards

## Identity and resolution

The portrait shows a moss-green, leaf-coated sloth sleeping across a flowering branch above a moonlit rainforest pool. Its long relaxed arms, warm face and broad pink blossoms establish a sheltered, unhurried mood. The selected ability images show a revealed waterfall stairway, a glowing double drawing thorns away from a sleeping body, and a dark cloud transformed into golden sparks

- Unhurried resolves at the end of each side’s turn, before the opposing side begins. Each living deployed Reverie independently heals every living deployed ally that played no cards that turn, including itself. Backup and knocked-out Reverie cannot provide the aura. Camp Hammock extends its healing to living backups that played no cards under the [shared recipient rules](../../KEYWORDS.md#healing-and-leech); knockouts remain excluded. Support cards count as activity; repeated effects count as one accepted play, and retaliation is not a card play. Activity follows the creature through swaps and saves and resets at its next turn start. Ordinary enemies use the base tier. Minions are deployed allies and may receive healing
- Healing uses ordinary maximum Health, healing modifiers and healing rewards. It is passive healing, so it does not grant card XP or card-only overheal rewards. Unlike Cadenza’s second-card trigger or Neradora’s every-other-turn self-heal, Unhurried rewards leaving specific creatures idle. An active Reverie can still heal resting partners, and a resting Reverie can heal itself while teammates act
- Dream Double grants Thorns and one non-stacking [Negate](../../KEYWORDS.md#negate). Thorns increase with ability upgrades; the protection remains one attack and survives swaps and resume. A repeated incoming attack can connect after protection is consumed
- Nightmare Harvest removes all harmful effects from living deployed allies through the shared Cleanse owner, including active control and Blind. Each distinct removed category on each recipient grants one shared Mana, capped at the shared Mana capacity, including Rainkeeper’s overflow allowance; stack amounts do not multiply the payout. An empty Cleanse grants none. Existing Cleanse rewards still apply. The Mana rate remains one through upgrades and room scaling. Repeats recheck the remaining effects. Ordinary enemies Cleanse their own side without granting player Mana; an enemy with a deck receives its own capped Mana

## Availability and balance

Reverie is recruitable and available in collected-species drafts. It is excluded from the first-run starter pool: the kit has reactive Thorns but no proactive attack

A normal turn shields Reverie with Dream Double, draws teammates’ options with Waking Wonder, and leaves injured allies idle when their healing is worth more than their card. A strong sequence protects against a hit, retaliates, then uses Nightmare Harvest to remove several allied afflictions and recover spending capacity. A weak hand contains Harvest without harmful effects or draw without useful follow-ups. Status-free opponents that avoid Reverie can deny Harvest’s payout and Thorns pressure; multi-hit/repeated attacks exhaust one protection

Dream Double and Harvest deliberately exceed a simple six-point estimate in favorable matchups: negation has no damage ceiling and Harvest can remove several categories and refill Mana. Their value is conditional, protection does not stack, and Mana cannot exceed the existing cap. Advanced Unhurried and duplicate Reveries can produce substantial healing when several creatures rest. Grove’s Favor rewards that healing; Cleanse rewards and Arcane Mending can amplify Harvest. These are user-selected rules and provisional balance observations, not measured win-rate acceptance

## Artwork

Unchanged originals from the [Reverie folder](https://drive.google.com/drive/folders/12zuk45o-vMtvj-FgrhjV20BxyH7SOHpM) are preserved under `public/art/reverie/` and identified in the [manifest](../../../assets/manifest.json).

The other ability illustrations are not part of the implemented kit. The lossless card recipe preserves the selected compositions at runtime sizes; source inspection and rendered review remain separate from artistic and balance acceptance
