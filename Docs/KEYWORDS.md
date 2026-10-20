# Keywords

Fauna's keyword foundation adapts Alchemy's catalog, effect-derived classification, word aliases, and consistent color families. `src/game/keywords.ts` owns stable IDs, labels, definitions, availability, damage types, and effect-to-keyword classification. `src/ui/tokens.css` owns a `--keyword-<id>` foreground for every entry. Shared selectors in `styles.css` apply that identity to keyword text, battle values, feedback, and progression. Existing damage, health and block tokens alias the keyword palette. Labels always accompany color; color is not the only way to identify a rule.

## Current rules

Physical, Fire, Ice, Lightning, Poison, Nature, and Light identify immediate damage. They imply no resistance, status application, or elemental matchups. Ice and Poison remain available vocabulary with no authored player attacks yet. Health, Mana, Block, Healing, Thorns, and Currency describe working rules. Their precise definitions live in the catalog and feed the menu Glossary.

Card keywords come from authored effects, never from their names or description text. Attacks classify by damage type; guard and team guard classify as Block; healing effects classify as Healing. Only the nine progression categories earn XP and own talents. Resource mentions, passives, secondary clauses, and planned keywords do not grant additional XP. Planned vocabulary does not imply implemented card effects.

`KeywordText` colors whole words and aliases while preserving the original sentence and casing. Active vocabulary alone is automatically highlighted. `Keyword` renders a catalog label. Neither component adds an interaction or extra tooltip; definitions remain in the menu Glossary. Card rules, passive descriptions, talents, and glossary prose share this renderer.

## Alchemy vocabulary carried forward

The following entries have assigned colors and proposed descriptions, but remain **planned**: Dodge, Armor, Forge, Burn, Freeze, Bleed, Stun, Leech, Wish, Consume, Archery, and Companion. They have no resolver, saved stacks, XP category, or player-facing glossary entry yet. The catalog's proposals preserve Alchemy's broad roles without presenting its hero-based rules as working creature rules.

Alchemy's Holy maps to Fauna's existing Light, and Gold maps to Currency; those words are presentation aliases, not new saved identities. Fire and Ice remain distinct from Burn and Freeze. Poison currently names immediate damage rather than Alchemy's damage-over-time status. Thorns describes Briartooth's existing passive rather than Alchemy's consumable stacks. Healing and Lightning extend the catalog for Fauna.

Before implementing the planned mechanics, decide creature-level timing and duration, stack decay and caps, blocked-hit interactions, knockout and swap behavior, and effect ordering. Freeze/Stun thresholds, Dodge chance, Leech ratio, Wish ownership/deck lifetime, and Companion's relationship to deployed and reserve creatures remain open design decisions. No values for these rules are committed by adding vocabulary.

## Cleanse and Purge

Two additional planned effect keywords complete the removal vocabulary:

- **Cleanse** removes harmful effects from an ally. Its assigned color is teal (`--keyword-cleanse`). Alchemy implements cleansing outside its formal keyword catalog; Fauna gives it an explicit keyword identity.
- **Purge** removes beneficial effects from an enemy. Its assigned color is fuchsia (`--keyword-purge`).

Both have labels, word aliases and shared color selectors. Like the other planned mechanics, they have no battle resolver, authored cards, XP category or player-facing glossary entry yet. Removal amounts and eligible effects will be defined with the battle implementation. Other suggested keywords remain deferred.

## Extending the system

1. Add a stable catalog ID with a label, category, definition, availability, and any word aliases. Aliases must be unique among active keywords.
2. Assign its foreground in `tokens.css` and connect its `data-keyword` and `data-combat-tone` selectors in `styles.css`. Preserve readable contrast on game surfaces. Alchemy's darker green, brown and red foregrounds use lighter members of the same families here.
3. Implement gameplay in the domain owner before marking the entry active. Update effect classification when the authored effect actually grants that keyword. Keep text and resolver behavior consistent.
4. Add progression eligibility deliberately; adding catalog vocabulary alone must not create talents or alter save validation. Change current save schemas and fixtures together if new saved state or progression identities are introduced; development saves are disposable and do not require migrations.
5. Test player outcomes, timing, preview parity, save/resume and rejected-command invariants as appropriate. CI owns full static, rendered and platform verification.

The foundation imports no Alchemy runtime, UI controls, plasma, shine effects, or dependencies. Fauna keeps its shadcn controls, artwork surfaces and visual policies.
