# Keywords

`src/game/keywords.ts` owns stable keyword IDs, labels, descriptions, aliases, damage types and effect classification. `src/ui/tokens.css` owns their semantic foregrounds. Color always accompanies readable labels. `KeywordText` highlights whole words while preserving text; it never assigns effects or XP.

## Glossary and terminology

[src/game/glossary.ts](../src/game/glossary.ts) assembles the complete in-game **Menu → Glossary**. Keep card text and feedback consistent with those owners.

Use Boon for passive journey items, Gold for permanent currency and Journey for a run. Current labels supersede historical relic, Holy and expedition wording in design records; internal identifiers need not change.

## Combat rules

These are the shared rules. Explicit creature, Talent and [Boon contracts](CONTENT.md#boon-selections) can modify them; the linked owners define those exceptions.

### Damage identities

Fauna adapts Alchemy's combat foundations to individual creatures. Physical, Nature, Water and Light are direct damage types. Water has a distinct blue identity, applies no status, is absorbed by Block and bypasses Armor reduction. Light retains Holy as a presentation alias. Burn, Freeze and Stun are the canonical damage identities; Fire, Ice and Lightning are not separate keywords or damage types. Health covers both remaining life and restoration; Healing is not a separate keyword.

### Periodic damage

Burn, Poison and Bleed hits deal immediate damage and add damage before Block as stacks, with applicable Armor mitigation. At the owner's turn window, Burn deals its stacks and halves (one clears); Poison deals its stacks and loses 20%, rounded normally with a minimum decay of one; Bleed deals its stacks once and clears. Block absorbs ticks normally; ticks cannot Dodge or crit, do not add stacks, and stop on knockout. Different statuses do not trigger elemental reactions.

### Stun and Freeze

Stun and Freeze deal damage and build toward one skipped action window. Both sides use half maximum Health as the threshold. A fatal hit cannot control a defeated target. Both share three turns of immunity after recovery. Active control and immunity prevent further buildup, while typed damage still resolves. Reserve creatures tick and expire effects normally; swapping neither cleanses nor refreshes them.

### Dodge and Critical hits

Attacks have a base 5% Dodge chance before defenses and attacks on both sides have a 5% critical chance for double damage. Controlled targets cannot Dodge. Extra Dodge is capped so total chance never exceeds 75%.

### Block and Armor

Block absorbs damage before Health and halves at the owner's next turn, rounded normally. Armor reduces Physical and Stun damage after Block when calculating Health loss. Armor loses one stack when it reduces damage, including when it absorbs the remaining damage entirely. A hit fully absorbed by Block does not wear Armor.

Block protects Health without suppressing hit effects, status buildup, Leech or damage-based reactions. Those mechanics use damage before Block, with applicable Armor mitigation. Leech includes absorbed damage and actual Health lost, capped by that mitigated hit so neither Armor nor overkill can inflate it. Rules explicitly based on Health lost continue to use actual Health loss. Grounding, Blood Ward and Venom Ward retain their explicit Block-dependent rules. Dodge and Negate remain separate from Block.

Hoard Lockplate is the explicit allied exception: applicable Armor reduces damage before Block is spent, without applying Armor twice, and wears when it reduces that damage. The default order remains Block, Armor, then Health loss.

### Thorns

Thorns retaliate for their current stack count as Nature damage when an opposing attack hits, including attacks fully absorbed by Block or Armor, then lose one stack; retaliation cannot trigger another retaliation. Thorns also retaliate when an attack is Negated. Dodge, periodic/derived damage and retaliation do not trigger Thorns. Stacks persist through turns, swaps and resume, use ordinary stack caps and protection sharing, and form one Purge category. Tidecrest Hairpin preserves the last allied stack during retaliation

Rootvault Pole allows allied Dodge against Thorns; control and the ordinary chance cap remain. Dodge rewards resolve without starting another retaliation chain

### Blind

Blind gives the next attack a 50% miss chance and expires on that attack, hit or miss; one seeded roll covers all its targets and damage packets. A miss uses the recipient's ordinary Dodge outcome, rewards and icon, even if control prevents normal Dodge. Support actions, periodic damage and retaliation do not consume Blind. Blind is non-stacking, Cleanseable and reflectable. [Moonveil Mask](content/boons.md#execution-contracts) lets enemy Blind persist when its own roll causes the miss.

### Temporary Dodge

Temporary Dodge expires at the owner's next turn, including in backup or on a skipped turn. Purge removes ordinary and temporary granted Dodge together; unrelated permanent Dodge survives expiry. Mirage Step grants this temporary bonus; Shifting Sands shares intrinsic current Dodge with other deployed allies without recursive aura amplification.

### Healing and Leech

Leech restores half damage dealt, including damage absorbed by Block, capped by applicable Armor, overkill and maximum Health. Bleed defers its Leech until the later Bleed tick; cleansing Bleed cancels that pending payout. Healing does not revive during combat. Enemies have no automatic round healing; healing requires an ability or passive.

### Cleanse and Purge

Cleanse removes harmful categories in Burn, Poison, Bleed, Stun, Freeze, Blind order, handling active control first. Purge removes Block first, then Armor, Thorns, bonus Dodge, Reflect, Burn-only Reflect, Nullify, the Freeze-damage ward, Negate and Attack Reflection, each as a separate beneficial category. Both remove up to the card's stated number of categories.

### Reflection

Reflect follows the scope stated by its granting effect. [Attack Reflection](#attack-reflection) returns the attack, including its damage and harmful follow-ups. Status-only reflection redirects Burn, Poison, Bleed, Stun, Freeze or Blind to a random living deployed opponent, including the attacker. Buildup retains its original post-mitigation strength; direct damage still lands on the original target. The recipient uses ordinary control thresholds and immunity. The reflecting creature owns the reflected status, which cannot reflect again.

A pending Reflect charge guarantees the next eligible reflection before passive chance is considered. Repeated grants refresh one charge; it survives turns, swaps and resume, resets each battle and can be Purged. Only a new eligible application spends protection or rolls passive reflection: immune/capped statuses and already present Blind do neither. Damage without status buildup, including Dodges, periodic ticks and ordinary retaliation, cannot trigger reflection; independently applied Blind remains eligible. Block does not suppress buildup or reflection. [Nullify](#nullify) is checked first. Burn-only Reflect is spent before unrestricted Reflect.

Star Hoop extends allied unrestricted Reflect and innate status reflection to incoming enemy Purge. The complete application returns to its attacker, retains ordinary Purge reactions and cannot reflect again. Burn-only Reflect does not qualify.

### Nullify

**Nullify** prevents the next applicable Burn, Poison, Bleed, Stun, Freeze or Blind application while leaving direct damage intact and existing statuses unchanged. It is non-stacking, lasts until consumed or Purged, and survives turns, swaps and resume. Dodge, periodic ticks, immunity, capped buildup and already present non-stacking effects do not consume it. Hits absorbed by Block still apply statuses and can consume Nullify. Nullify precedes reflection and can stop reflected statuses. Repeated grants refresh one protection rather than adding charges. It is combat vocabulary, not a progression category.

### Negate

**Negate** cancels the next incoming ability attack against its recipient after interception and before Dodge, preserving Block and Armor and preventing that attack's harmful follow-ups on that recipient. Thorns still retaliate once with their normal decay. A Blind miss leaves protection intact; other recipients of an area attack and a subsequent repeat resolve independently. Periodic, proc and retaliation packets do not consume it. Protection does not stack, lasts until consumed or Purged and persists through swaps and resume. Dream Double grants it to its actor. Negate awards no separate keyword XP. [Echo Lens](content/boons.md#execution-contracts) can return that same Negated enemy attack through the existing attack-reflection rules

### Attack Reflection

Attack Reflection returns the next incoming ability attack to its attacker after interception and Negate, before Dodge, Block or Armor. The protected recipient takes none of that attack’s damage or harmful authored follow-ups. Other area recipients remain affected. The returning attack uses the ward bearer as its source and ordinary damage resolution; it cannot reflect again. Harmful follow-ups return only if the attacker survives and does not Negate the returned attack. The original attacker retains self-directed support effects if alive

One protection lasts until consumed or Purged, survives swaps and resume and resets each battle. Repeated grants refresh it without stacking. Blind misses, periodic, proc and retaliation damage do not consume it. Repeated attacks resolve separately. This is separate from harmful-status Reflect and awards no separate keyword XP

### Resurrection

Resurrect returns a knocked-out roster ally with 20% of maximum Health, rounded normally with a minimum of one. It can target deployed allies or backups; their positions and card ownership stay intact. Living allies and Minions are not recipients. Resurrection is direct restoration of life, unaffected by healing modifiers and without healing-trigger rewards. Existing combat effects and per-battle counters remain; spent Death’s Door is not renewed and grace does not restart. Resurrect awards Health XP on the accepted card play

### Food

Food is shared consumable card vocabulary and awards no separate keyword XP. The [shared Food contract](CONTENT.md#shared-food-cards) owns targeting, neutral ownership, consumption and interactions; [Food definitions](../src/game/content/food.ts) own the available effects.

### Draws and returns

Ordinary, keyword and owner-specific draws use the shared [card-zone owner](../src/game/card-zones.ts). Direct Discard recovery, including Cadenza, Almanelle and Wisterelle, also counts as a draw: it retains the existing card’s identity and can trigger Well Read, draw Boons and Wisterelle’s Lost and Found. Copies and overflow promotion do not create additional draws. Dream Yo-Yo and Cloud Cup-and-Ball return cards without drawing; recycling Discard into Draw does not itself trigger Lost and Found.

### Consume

**Consume** removes a card from the battle after its accepted play resolves, including repeated effects and the one court trigger. Played Pearls never enter Discard; unplayed Pearls discard and recycle normally. Consumption frees space under the battle card limit. Rejected plays retain the card and RNG unchanged.

### Death's Door

Each allied creature has Death's Door once per battle: fatal damage leaves one Health with two grace turns. Fatal packets during grace still leave one Health; subsequent damage can knock it out after grace expires. Reserve turns also spend grace. Combat effects, immunity and Death's Door reset for each battle; Health and knockouts persist between destinations.

## Classification and progression

### Keyword XP

Card XP comes from structured primary and supplemental effects and Leech metadata, once per distinct eligible keyword on an accepted play. Descriptions derive from those same effects. Progression has fifteen categories: Physical, Burn, Freeze, Stun, Poison, Nature, Water, Light, Bleed, Block, Health, Armor, Dodge, Leech and Mana. Thorns awards Nature, Cleanse awards Health, and Purge awards Light. Combat damage and status identities retain their ordinary rules. Forge is removed entirely.

### Talent rows

The [authored talent catalog](../src/game/content/talents.ts) covers applicable Alchemy effects for these categories. Keep the original two talents first; later talents form rows of two (the final row may contain one). Buy either talent in a row, then complete that row to open the next. Alchemy Holy uses Light, Health uses the Health category, and Mana Crystals use maximum Mana. Talents depending on Forge, Wish, Consume, Companion, Archery or losing Mana Crystals are excluded.

### Modifier timing

Positive healing and effect values round to the nearest integer; received-healing modifiers combine before rounding. Poison and Bleed healing reductions multiply when both apply.

Opening effects apply only at battle start to deployed creatures, never on purchases, resets, swaps or resume. Flashpoint is consumed by the first accepted Burn play whether or not it is currently purchased.

A Mana Crystal is one point of maximum Mana; Raincatcher Bowl adds one while the battle deck includes a Water card. Leyline Attunement raises base Mana from four to five each battle; Wellspring and Dark Recovery can add one more for the next turn, up to seven with Raincatcher Bowl. Resetting preserves the current turn's granted Mana; the next turn uses the current talents. Arcane Mending heals each living deployed creature for actual shared Mana gained, including turn restoration.

### Repeats and derived effects

Creature-owned Dodge follow-ups, free-card charges and once-per-battle defenses persist through swaps and resume. Repeated cards resolve their full effects at most twice and stop if their actor falls. A fallen individual attack target normally ends the repeat; [Dream Tangram](content/boons.md#execution-contracts) redirects an already-granted repeat to the first living opponent without adding another resolution. Ability and damage repeats spend no extra Mana and grant no extra XP or accepted-play count. Dancing Double prepares the side’s next card, including shared Food, to resolve twice; the pending grant survives turns, swaps and resume and never stacks with other repeats beyond two resolutions. Supplemental talent damage can build statuses and control but cannot Dodge, critically hit, retaliate or trigger another chance-damage chain.

Card-only overhealing can grant Block or Cleanse; ordinary healing and Leech cannot. Passive healing uses ordinary healing modifiers and healing-triggered Boons, without card-only overhealing rewards or ability-only healing bounces.

### Attribution and kill rewards

Periodic damage remembers the last source per status for kill credit; Bleed retains individual Leech contributions. Source IDs remain valid across backup swaps. Derived Icy Heart damage cannot Dodge, critically strike, build status, retaliate or trigger another Freeze. Bone Charm heals the credited living creature once per enemy defeat. These effects use normal resolution and never create extra accepted-play XP.

### Gold and excluded categories

Talent Gold banks immediately, survives defeat and abandonment, and is included once in the battle receipt; previews only change their detached result. Gold remains permanent currency and a battle reward. It is not a keyword, does not receive keyword highlighting, earns no keyword XP and has no talent tree. Wish, Companion and Archery are excluded from Fauna's catalog, cards and mechanics. Consume is card vocabulary and does not award keyword XP or have a talent tree.

## Extending the system

Implement rules in the pure gameplay owner before exposing a keyword. Add structured effect classification, generated wording, current-format save validation and semantic presentation together. Cover actual outcomes, timing, preview parity, rejected commands, swaps and resume at their owning boundaries. Development saves are disposable: reject obsolete versions without migrations. Follow [Contributing](../CONTRIBUTING.md#verification) for verification and [Release](RELEASE.md) for platform qualification.
