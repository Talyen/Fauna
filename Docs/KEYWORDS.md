# Keywords

`src/game/keywords.ts` owns stable keyword IDs, labels, descriptions, aliases, damage types and effect classification. `src/ui/tokens.css` owns their semantic foregrounds. Color always accompanies readable labels. `KeywordText` highlights whole words while preserving text; it never assigns effects or XP.

## Combat rules

### Damage identities

Fauna adapts Alchemy's combat foundations to individual creatures. Physical, Nature, Water and Light are direct damage types. Water has a distinct blue identity, applies no status, is absorbed by Block and bypasses Armor reduction. Light retains Holy as a presentation alias. Burn, Freeze and Stun are the canonical damage identities; Fire, Ice and Lightning are not separate keywords or damage types. Health covers both remaining life and restoration; Healing is not a separate keyword.

### Periodic damage

Burn, Poison and Bleed hits deal immediate damage and add their resolved damage as stacks. At the owner's turn window, Burn deals its stacks and halves (one clears); Poison deals its stacks and loses 20%, rounded normally with a minimum decay of one; Bleed deals its stacks once and clears. Ticks bypass Block, cannot Dodge or crit, do not add stacks, and stop on knockout. Different statuses do not trigger elemental reactions.

### Stun and Freeze

Stun and Freeze deal damage and build toward one skipped action window. Both sides use half maximum Health as the threshold. A fatal hit cannot control a defeated target. Both share three turns of immunity after recovery. Active control and immunity prevent further buildup, while typed damage still resolves. Reserve creatures tick and expire effects normally; swapping neither cleanses nor refreshes them.

### Dodge and Critical hits

Attacks have a base 5% Dodge chance before defenses and attacks on both sides have a 5% critical chance for double damage. Controlled targets cannot Dodge. Extra Dodge is capped so total chance never exceeds 75%.

### Block and Armor

Block absorbs damage before Health and halves at the owner's next turn, rounded normally. Armor reduces Physical and Stun damage after Block and loses one stack when positive damage gets through.

### Thorns and Water Thorns

Thorns retaliate for their current stack count as Nature damage after an attack removes Health, then lose one stack; retaliation cannot trigger another retaliation. Water Thorns follow the same trigger and decay but deal Water damage from a separate stack pool; both can retaliate from one qualifying attack while the defender survives. Neither triggers from Dodge, full absorption, periodic/derived damage or retaliation.

Water Thorns persist through turns, swaps and resume, use ordinary stack caps and protection sharing, and remain a separate Purge category after Nature Thorns.

### Blind

Blind gives the next attack a 50% miss chance and expires on that attack, hit or miss; one seeded roll covers all its targets and damage packets. A miss uses the recipient's ordinary Dodge outcome, rewards and icon, even if control prevents normal Dodge. Support actions, periodic damage and retaliation do not consume Blind. Blind is non-stacking, Cleanseable and reflectable.

### Temporary Dodge

Temporary Dodge expires at the owner's next turn, including in backup or on a skipped turn. Purge removes ordinary and temporary granted Dodge together; unrelated permanent Dodge survives expiry. Mirage Step grants this temporary bonus; Shifting Sands shares intrinsic current Dodge with other deployed allies without recursive aura amplification.

### Healing and Leech

Leech restores half actual Health lost, capped by overkill and maximum Health. Bleed defers its Leech until the later Bleed tick; cleansing Bleed cancels that pending payout. Healing does not revive during combat. Enemies have no automatic round healing; healing requires an ability or passive.

### Cleanse and Purge

Cleanse removes harmful categories in Burn, Poison, Bleed, Stun, Freeze, Blind order, handling active control first. Purge removes Block first, then Armor, Thorns, Water Thorns, bonus Dodge, Reflect, Burn-only Reflect, Nullify, the Freeze-damage ward and Negate, each as a separate beneficial category. Both remove up to the card's stated number of categories.

### Reflection

Reflection redirects Burn, Poison, Bleed, Stun, Freeze or Blind to a random living deployed opponent, including the attacker. Buildup retains its original post-mitigation strength; direct damage still lands on the original target. The recipient uses ordinary control thresholds and immunity. The reflecting creature owns the reflected status, which cannot reflect again.

A pending Reflect charge guarantees the next eligible reflection before passive chance is considered. Repeated grants refresh one charge; it survives turns, swaps and resume, resets each battle and can be Purged. Only a new eligible application spends protection or rolls passive reflection: immune/capped statuses and already present Blind do neither. Damage without status buildup, including Dodges, full absorption, periodic ticks and ordinary retaliation, cannot trigger reflection; independently applied Blind remains eligible. [Nullify](#nullify) is checked first. Burn-only Reflect is spent before unrestricted Reflect.

### Nullify

**Nullify** prevents the next applicable Burn, Poison, Bleed, Stun, Freeze or Blind application while leaving direct damage intact and existing statuses unchanged. It is non-stacking, lasts until consumed or Purged, and survives turns, swaps and resume. Dodge, fully blocked damage, periodic ticks, immunity, capped buildup and already present non-stacking effects do not consume it. Nullify precedes reflection and can stop reflected statuses. Repeated grants refresh one protection rather than adding charges. It is combat vocabulary, not a progression category.

### Negate

**Negate** cancels the next incoming ability attack against its recipient after interception and before Dodge, preserving Block and Armor and preventing that attack's harmful follow-ups on that recipient. Thorns and Water Thorns still retaliate once with their normal decay. A Blind miss leaves protection intact; other recipients of an area attack and a subsequent repeat resolve independently. Periodic, proc and retaliation packets do not consume it. Protection does not stack, lasts until consumed or Purged and persists through swaps and resume. Dream Double grants it to its actor. Negate awards no separate keyword XP

### Consume

**Consume** removes a card from the battle after its accepted play resolves, including repeated effects and the one court trigger. Played Pearls never enter Discard; unplayed Pearls discard and recycle normally. Consumption frees space under the battle card limit. Rejected plays retain the card and RNG unchanged.

### Death's Door

Each allied creature has Death's Door once per battle: fatal damage leaves one Health with two grace turns. Fatal packets during grace still leave one Health; subsequent damage can knock it out after grace expires. Reserve turns also spend grace. Combat effects, immunity and Death's Door reset for each battle; Health and knockouts persist between destinations.

## Classification and progression

### Keyword XP

Card XP comes from structured primary and supplemental effects and Leech metadata, once per distinct eligible keyword on an accepted play. Descriptions derive from those same effects. Progression has fifteen categories: Physical, Burn, Freeze, Stun, Poison, Nature, Water, Light, Bleed, Block, Health, Armor, Dodge, Leech and Mana. Thorns awards Nature, Water Thorns awards Water, Cleanse awards Health, and Purge awards Light. Combat damage and status identities retain their ordinary rules. Forge is removed entirely.

### Talent rows

The [authored talent catalog](../src/game/content/talents.ts) covers applicable Alchemy effects for these categories. Keep the original two talents first; later talents form rows of two (the final row may contain one). Buy either talent in a row, then complete that row to open the next. Alchemy Holy uses Light, Health uses the Health category, and Mana Crystals use maximum Mana. Talents depending on Forge, Wish, Consume, Companion, Archery or losing Mana Crystals are excluded.

### Modifier timing

Positive healing and effect values round to the nearest integer; received-healing modifiers combine before rounding. Poison and Bleed healing reductions multiply when both apply.

Opening effects apply only at battle start to deployed creatures, never on purchases, resets, swaps or resume. Flashpoint is consumed by the first accepted Burn play whether or not it is currently purchased.

Leyline Attunement raises base Mana from four to five each battle; Wellspring and Dark Recovery can add one more for the next turn, up to six. Resetting preserves the current turn's granted Mana; the next turn uses the current talents. Arcane Mending heals each living deployed creature for actual shared Mana gained, including turn restoration.

### Repeats and derived effects

Creature-owned Dodge follow-ups, free-card charges and once-per-battle defenses persist through swaps and resume. Repeated cards resolve their full effects at most twice and stop if their actor or attack target falls. Ability and damage repeats spend no extra Mana and grant no extra XP or accepted-play count. Supplemental talent damage can build statuses and control but cannot Dodge, critically hit, retaliate or trigger another chance-damage chain.

Card-only overhealing can grant Block or Cleanse; ordinary healing and Leech cannot. Passive healing uses ordinary healing modifiers and healing-triggered Boons, without card-only overhealing rewards or ability-only healing bounces.

### Attribution and kill rewards

Periodic damage remembers the last source per status for kill credit; Bleed retains individual Leech contributions. Source IDs remain valid across backup swaps. Derived Icy Heart damage cannot Dodge, critically strike, build status, retaliate or trigger another Freeze. Bone Charm heals the credited living creature once per enemy defeat. These effects use normal resolution and never create extra accepted-play XP.

### Gold and excluded categories

Talent Gold banks immediately, survives defeat and abandonment, and is included once in the battle receipt; previews only change their detached result. Gold remains permanent currency and a battle reward. It is not a keyword, does not receive keyword highlighting, earns no keyword XP and has no talent tree. Wish, Companion and Archery are excluded from Fauna's catalog, cards and mechanics. Consume is card vocabulary and does not award keyword XP or have a talent tree.

## Extending the system

Implement rules in the pure gameplay owner before exposing a keyword. Add structured effect classification, generated wording, current-format save validation and semantic presentation together. Cover actual outcomes, timing, preview parity, rejected commands, swaps and resume at their owning boundaries. Development saves are disposable: reject obsolete versions without migrations. Follow [Contributing](../CONTRIBUTING.md#verification) for verification and [Release](RELEASE.md) for platform qualification.
