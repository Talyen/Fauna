# Fauna

A single-player creature-collecting card battler for Steam. Choose a starter and recruit companions, combining their cards in one shared deck. Find combinations, recruit new teammates, and reach the heart of the wilds.

Play an eight-encounter journey with bosses fourth and last, collect keyword XP and Gold, recruit backup creatures, and choose journey Boons. The first journey starts with one creature chosen from three seeded offers; later journeys draft three starters from Collection. Creatures and abilities use production illustrations; encounter and location artwork still includes placeholders.

## Run

Use Node 24 (`.node-version`) and npm 11+.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:48209. Prepared outputs are checked before startup; media authoring uses `npm run assets:prepare`. To use the Electron shell instead:

```sh
npm run dev:desktop
```

Owned previews use isolated ports and disposable browser/desktop profiles; `npm run dev:desktop` opens a quiet owned preview. Browser and normal desktop profiles are separate. Desktop saves live in Electron's Fauna user-data directory under `saves/expedition.json`; browser saves use the `fauna.save.v1` localStorage key. Both keep two backups. Development saves are disposable: only the current format is supported, with no migration or backward-compatibility requirement. Use a fresh browser context for experiments instead of deleting player saves.

## Play

Inspect the starter offers, choose your starting creature or team, then begin the journey. Every deployed creature contributes three cards, each with a base cost of 1 Mana. Keep up to seven cards in hand; each turn normally restores four Mana and draws four cards, with explicit talent and Boon modifiers. Extra draws wait in a hidden, unplayable buffer and fill open hand slots in order as cards are played. End turn discards the visible hand and retains the buffer. Select a card and any required enemy or ally; confirm team-wide actions with Play. Enemy actions remain hidden. Block absorbs attacks, and each creature has a passive trait.

Knocked-out creatures cannot act; their cards retain inert slots until replaced by a swap. Defeat the enemy row to bank XP/currency. Health and knockouts persist between battles; Campfire appears beside destination choices whenever any roster creature, including a reserve or knockout, is missing at least 30% of maximum Health. Rest restores 30% maximum Health to the whole roster, capped at full Health, and returns to the same combat offers without advancing the encounter or changing RNG. It remains available while the threshold is met.

The shared Victory screen offers required recruitment after ordinary combat or optional Boon choices after intermediate bosses. Recruiting, choosing a Boon or skipping a Boon advances directly. Choose from the defeated creatures (one in the first battle, two in the second, three thereafter), including species already owned, to build a five-creature roster. Each copy has its own battle state. Recruits fill the starting lineup up to three creatures, then join the two reserves.

The starting lineup is remembered and optionally editable from the menu between battles. Swap freely during combat; incoming cards replace outgoing cards in their current zones without healing, drawing, or spending Mana. Healthy reserves can replace fallen creatures; defeat requires the entire roster to fall.

Optional Merchants sell journey Boons for permanent Gold without replacing battles, appearing only when at least one item is affordable. Keyword XP unlocks shared permanent talents; talents can be bought or reset at any time through the menu. Winning, losing or ending a run preserves discoveries.

- Mouse: select cards and targets. Hover over artwork for details; right-click to pin inspection outside battle.
- Keyboard: W/A/S/D navigate, Enter/Space activate, I opens inspection outside battle, Escape cancels or opens the menu. Tab remains available.
- Standard controller: D-pad/left stick navigate, south/A confirms, east/B backs out, west/X inspects outside battle, north/Y ends the turn. Button mapping follows standard Xbox-style positions. Non-standard mappings are not yet supported.

Gameplay settles before visual feedback. Accepted commands automatically save; failed writes retry automatically in the background without player-facing notices. Desktop close requests wait for queued saves. Browsers show no save warning on exit; abrupt browser/process termination cannot guarantee completion of queued writes.

## Verify

[Contributing](CONTRIBUTING.md#verification) owns the verification commands, local resource limits and CI policy. Default local checks cover bounded formatting and fixed Node smoke; full static, unit/DOM, build, browser and packaged Windows verification belong to CI. See [release boundaries](Docs/RELEASE.md) for the remaining shipping gates.

## Architecture and authoring

Current contracts and workflows:

- [Contribution workflow and verification](CONTRIBUTING.md), [agent instructions](AGENTS.md) and [script implementation map](scripts/README.md)
- [Architecture, commands and saves](Docs/ARCHITECTURE.md)
- [Content, ability costs and artwork](Docs/CONTENT.md)
- [Keywords and combat rules](Docs/KEYWORDS.md) and [gameplay glossary](Docs/GLOSSARY.md)
- [Journey progression and rewards](Docs/EXPEDITION_DESIGN.md)
- [UI, layout and accessibility](Docs/UI.md), [menus and inspection](Docs/MENU_DESIGN.md) and [shared design system](Docs/DESIGN_SYSTEM.md)
- [Development tools, previews, playthroughs and diagnostics](Docs/DEVELOPMENT_TOOLS.md)
- [Release and platform verification boundaries](Docs/RELEASE.md)

Historical records retain earlier proposals and rollout evidence; the current contracts above take precedence:

- [Design studies and decisions](design/README.md)
- [Alchemy feature adoption](Docs/ALCHEMY_ADOPTION_PLAN.md)
- [Alchemy tools and platform adoption](Docs/ALCHEMY_PLATFORM_PLAN.md)
- [CI speed plan and rollout measurements](Docs/CI_SPEED_PLAN.md)

Alchemy informed the technology choices and architectural patterns. Fauna has its own implementation and no runtime dependency on Alchemy. Mana crystal UI sprites are adapted from Alchemy; provenance is recorded in the battle-layout sample README.
