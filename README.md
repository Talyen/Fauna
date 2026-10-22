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

Choose your starter, recruit creatures into a five-member roster, and combine your deployed creatures' abilities in one shared deck. Every ability has a base cost of 1 Mana. Swap deployed creatures with healthy reserves during combat, and use their passives and keyword combinations to win eight encounters, with bosses fourth and last.

Between battles, recruit teammates, buy journey Boons, or recover at a Campfire when available. Keyword XP, Collection discoveries, talents and Gold provide permanent progression. See [Journey progression](Docs/EXPEDITION_DESIGN.md) for the complete roster, combat, reward and destination rules, and [content authoring](Docs/CONTENT.md) for ability and artwork contracts.

- Mouse: select cards and targets. Hover over artwork for details; right-click to pin inspection outside battle.
- Keyboard: W/A/S/D navigate, Enter/Space activate, I opens inspection outside battle, Escape cancels or opens the menu. Tab remains available.
- Standard controller: D-pad/left stick navigate, south/A confirms, east/B backs out, west/X inspects outside battle, north/Y ends the turn. Button mapping follows standard Xbox-style positions. Non-standard mappings are not yet supported.

Gameplay settles before visual feedback. Accepted commands automatically save; failed writes retry automatically in the background without player-facing notices. Desktop close requests wait for queued saves. Browsers show no save warning on exit; abrupt browser/process termination cannot guarantee completion of queued writes.

## Verify

[Contributing](CONTRIBUTING.md#verification) owns the verification commands, local resource limits and CI policy. Default local checks cover bounded formatting and fixed Node smoke; full static, unit/DOM, build, browser and packaged Windows verification belong to CI. See [release boundaries](Docs/RELEASE.md) for the remaining shipping gates.

## Architecture and authoring

Current contracts and workflows live directly under `Docs/`; completed implementation, adoption and rollout records live under `Docs/archive/`. Archiving records implementation history and does not establish CI, rendered or release acceptance.

Current contracts and workflows:

- [Feature roadmap: completed work and future suggestions](Docs/ROADMAP.md)
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
- [Alchemy feature adoption](Docs/archive/ALCHEMY_ADOPTION_PLAN.md)
- [Alchemy tools and platform adoption](Docs/archive/ALCHEMY_PLATFORM_PLAN.md)
- [CI speed plan and rollout measurements](Docs/archive/CI_SPEED_PLAN.md)
- [Shared ability resolution and approved rule alignment](Docs/archive/COMBAT_RESOLUTION_PLAN.md)
- [Combat reaction ordering and implementation record](Docs/archive/COMBAT_REACTIONS_PLAN.md)

Alchemy informed the technology choices and architectural patterns. Fauna has its own implementation and no runtime dependency on Alchemy. Mana crystal UI sprites are adapted from Alchemy; provenance is recorded in the battle-layout sample README.
