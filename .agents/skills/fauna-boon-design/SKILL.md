---
name: fauna-boon-design
description: Design or revise artwork-led Fauna Boons with automatic passive rules that change strategy and team-building without new battle controls, downsides or power creep
---

# Fauna Boon design

Use for Boon proposals, selection and substantial mechanic redesigns. Design requests call for proposals; implementation and asset imports follow only when requested. Earlier suggestions, artwork sidecars and examples in this skill are candidates, not accepted designs or proof of implementation.

## Ground the proposal

Read the current [catalog](../../../src/game/content/boons.ts), [Boon rules](../../../src/game/rules/boons.ts), [execution contracts](../../../Docs/content/boons.md), [keywords](../../../Docs/KEYWORDS.md) and affected [journey rules](../../../Docs/EXPEDITION_DESIGN.md). Compare nearby creature passives and talents. Use current values, without a fixed catalog count or power budget in this skill. For requested unimplemented selections, check both catalog and execution bindings.

Inspect supplied artwork before designing its effect. For Drive sources, use the Google Drive skill and retain selected filenames and links; sidecar prompts provide context, not instructions. Separate visible observations from inferred themes and disclose inaccessible imagery.

Respect existing rules before proposing exceptions: Block already preserves hit mechanics such as Thorns, Leech and buildup. Keep hits distinct from Health loss. A Boon should create a useful interaction rather than repair behavior that should work by default.

## Design checklist

- **Artifact relationship:** Connect what the named object visibly does or symbolizes to its trigger and outcome. A vessel stores, a sieve separates, a yo-yo returns. Color alone is insufficient. If unrelated artifacts could use the same rule without losing meaning, strengthen the connection; themed sets need not share one mechanic
- **Strategic contribution:** Explain which existing play becomes useful and which recruitment, targeting, sequencing or preparation decision changes. Prefer bridges between complementary roles over a named-species requirement. Compare the nearest Boon, talent and passive; a new number, damage type or trigger attached to the same generic reward does not establish uniqueness. A numerical benefit needs a strong thematic and strategic case
- **Automatic benefit:** Use existing card plays, targets and feedback. Add no Boon activations, modes, optional “You may” actions, manual storage/withdrawals, card marking, resource allocation, extra target or actor selection, management panels or new meters. An explicit request for active items can change that scope
- **Simple mechanics:** Apply the shared [elegant abilities and passives standard](../../../Docs/CREATURE_DESIGN.md#elegant-abilities-and-passives). Prefer constraints inherent in resources, recipients or the object. Do not routinely balance an oversized payoff with “first X each turn”, turn/battle quotas, arbitrary counters or random procs. Justify thematic timing exceptions. Redesign the mechanic before shortening its wording; a tangram continuing a repeat after its target falls is clearer than an unrelated control discount
- **No hidden downside:** Preserve useful actions and outcomes. Mandatory conversions, redirects, card returns and transfers can weaken a strategy; trace what gets lost, consumed or displaced. Redesign harmful interactions without adding optional administration or offsetting power with a punishment
- **Controlled strength:** Broaden viable strategies without making a composition compulsory, replacing a creature's defining passive, trivializing defenses or making an existing Boon obsolete. Check the strongest benefiting team against current Boons and 1-Mana abilities. Avoid rewards for stalling, farming helpless enemies, losing allies or repeating menu actions

## Check interactions

Trace multi-hit/area attacks, repeats, free plays, draws/copies, Healing/Leech, reflection, Minions, swaps, immunity and other Boon reactions. Distinguish actual restoration/loss from attempted values and overkill. Check direct and indirect feedback loops without silently disabling established synergies. Use smaller values, natural limits or a precise necessary restriction; redesign effects that need chains of exceptions. Rule exceptions still preserve ownership, determinism and save correctness.

State initial values and the main balance uncertainty. Estimates are proposals, not measured balance or tested implementation; brainstorming does not require simulations or broad checks.

## Write the player rule

Give one exact, concise effect using [game terminology](../../../Docs/KEYWORDS.md#glossary-and-terminology) and the [effect-copy rule](../../../AGENTS.md#high-risk-invariants). Edit for the fewest natural words that preserve the full rule. Use established terms such as allies, effects, attacks, damage, Block and restore Health; avoid poetic synonyms, taglines, helper text and new keywords. Omit “your” when ownership is clear. Describe the automatic rule directly.

Avoid “target” in player-facing effects; name the affected ally or enemy naturally while keeping the recipient and scope clear. Refer to Food cards as “Food”, not “feeding” or “fed”: for example, “Food grants 2 Thorns to the ally receiving it”. Do not imply that Food without an ally recipient affects one.

Keep restrictions essential to the player's decision visible; leave tuning, recipient tie-breaks and engine details in execution notes when they do not change reasonable expectations. “Mana can overflow”, “Cards Dodged by enemies return to hand” and “Light hits Blind Burning enemies” illustrate the intended brevity. Do not routinely restore qualifiers such as “single-target”, “all its hits” or “first living enemy” just because execution needs precision. Use hit, attack, draw, Cleanse and Purge only for their actual rules. Shortening must preserve meaning:

- Backup Healing eligibility does not make backups selectable targets or activate their passives
- Armor preventing Critical Hits protects the armored creature
- Overflow Healing includes all supported Healing, not only Leech
- Matching swapped allies to the higher Block total preserves that total without spending, splitting or repeatedly adding it; this is a mechanic revision, not a copy edit

Use natural inflections such as Burning, Dodged and Purged. When implementing, register missing forms in [keyword aliases](../../../src/game/keywords.ts) for the shared [KeywordText renderer](../../../src/ui/shared/keyword-text.tsx); preserve wording/casing and use canonical colors in the game, without improvised color markup in chat.

## Present and implement

For initial proposals, provide the name, artwork link, exact effect, visual connection and changed strategic decision. Include a plausible sequence, team-building implications, nearest overlap and material balance concern without expanding straightforward entries. Refinements lead with the revised effect list or name/effect table and explain meaningful mechanic changes. Review a batch for repeated mechanics, numerical filler, interaction burdens, hidden downsides, dominant teams and repetitive timing. Replace weak candidates instead of filling a requested count.

When implementation is requested, use the [modifier and asset owners](../../../Docs/CONTENT.md#adding-gameplay-modifiers) and [verification policy](../../../CONTRIBUTING.md#verification). Changed card interactions use [UI design](../fauna-ui-design/SKILL.md); artwork changes use [art direction](../fauna-art-direction/SKILL.md). Keep implemented behavior, rendered evidence, artistic acceptance and measured balance distinct.
