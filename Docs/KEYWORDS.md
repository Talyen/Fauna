# Keywords

`src/game/keywords.ts` owns stable keyword IDs, labels, descriptions, aliases, damage types and effect classification. `src/ui/tokens.css` owns their semantic foregrounds. Color always accompanies readable labels. `KeywordText` highlights whole words while preserving text; it never assigns effects or XP.

## Combat rules

Fauna adapts Alchemy's combat foundations to individual creatures. Physical, Fire, Ice, Lightning, Nature and Light are direct damage types. Light retains Holy as a presentation alias. Fire, Ice and Lightning do not implicitly inflict Burn, Freeze or Stun; those are explicit separate packets in a card's rules.

Burn, Poison and Bleed hits deal immediate damage and add their resolved damage as stacks. At the owner's turn window, Burn deals its stacks and halves (one clears); Poison deals its stacks and loses 20%, rounded normally with a minimum decay of one; Bleed deals its stacks once and clears. Ticks bypass Block, cannot Dodge or crit, do not add stacks, and stop on knockout. Different statuses do not trigger elemental reactions.

Stun and Freeze deal damage and build toward one skipped action window. Allies use half maximum Health as the threshold; enemies use half their Health before that packet. A fatal hit cannot control a defeated target. Both share three turns of immunity after recovery. Active control and immunity prevent further buildup, while typed damage still resolves. Living enemies regenerate one Health after allied status ticks, including on skipped actions. Reserve creatures tick and expire effects normally; swapping neither cleanses nor refreshes them.

Attacks have a base 5% Dodge chance before defenses and allied attacks have a 5% critical chance for double damage. Controlled targets cannot Dodge. Extra Dodge is capped so total chance never exceeds 75%. Block absorbs damage before Health and halves at the owner's next turn, rounded normally. Armor reduces Physical and Stun damage after Block and loses one stack when positive damage gets through. Thorns retaliate with Nature damage after an attack removes Health, then lose one stack; retaliation cannot trigger another retaliation.

Leech restores half actual Health lost, capped by overkill and maximum Health. Bleed defers its Leech until the later Bleed tick; cleansing Bleed cancels that pending payout. Healing does not revive during combat. Cleanse removes harmful categories in Burn, Poison, Bleed, Stun, Freeze order, handling active control first. Purge removes Block first, then Armor, Thorns and bonus Dodge. Both remove up to the card's stated number of categories.

Each allied creature has Death's Door once per battle: fatal damage leaves one Health with two grace turns. Fatal packets during grace still leave one Health; subsequent damage can knock it out after grace expires. Reserve turns also spend grace. Combat effects, immunity and Death's Door reset for each battle; Health and knockouts persist between destinations.

## Classification and progression

Card XP comes from structured primary and supplemental effects and Leech metadata, once per distinct eligible keyword on an accepted play. Descriptions derive from those same effects. Progression has fourteen categories: Physical, Fire / Burn, Ice / Freeze, Lightning / Stun, Poison, Nature, Light, Bleed, Block, Healing, Armor, Dodge, Leech and Mana. Fire and Burn award the same category once per play; likewise Ice/Freeze and Lightning/Stun. Thorns awards Nature, Cleanse awards Healing, and Purge awards Light. Combat damage and status identities retain their ordinary rules. Forge is removed entirely.

Each category has two distinct talents in `src/game/progression.ts`, purchased in either order. Positive healing and effect values round to the nearest integer; received-healing modifiers combine before rounding. Poison and Bleed healing reductions multiply when both apply. Opening effects apply only at battle start to deployed creatures, never on purchases, resets or swaps. Flashpoint is consumed by the first accepted Fire/Burn play whether or not it is currently purchased. Mana talents can raise the next turn to five Mana; resetting a talent preserves Mana already granted. The base remains four.

Periodic damage remembers the last source per status for kill credit; Bleed retains individual Leech contributions. Source IDs remain valid across reserve swaps. Derived Icy Heart damage cannot Dodge, critically strike, build status, retaliate or trigger another Freeze. Bone Charm heals the credited living creature once per enemy defeat. These effects use normal resolution and never create extra accepted-play XP.

Gold remains permanent currency and a battle reward. It is not a keyword, does not receive keyword highlighting, earns no keyword XP and has no talent tree. Wish, Consume, Companion and Archery are excluded from Fauna's catalog, cards and mechanics.

## Extending the system

Implement rules in the pure gameplay owner before exposing a keyword. Add structured effect classification, generated wording, current-format save validation and semantic presentation together. Cover actual outcomes, timing, preview parity, rejected commands, swaps and resume at their owning boundaries. Development saves are disposable: reject obsolete versions without migrations. Full static, rendered and platform verification remain CI-owned.
