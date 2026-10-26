# Fauna

A single-player creature-collecting card battler for Steam. Choose a starter, recruit companions and combine their cards in one shared deck through an eight-encounter journey. Creature and ability illustrations are in place; some encounter/location art remains placeholder. See the [roadmap](Docs/ROADMAP.md) for current capabilities and open work.

## Run

Use the Node version in `.node-version` and npm version in `package.json`:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:48209. Use `npm run dev:desktop` for the Electron shell. Development/build commands validate prepared media; [media authoring](Docs/CONTENT.md#prepared-assets) uses `npm run assets:prepare`.

For isolated task checkouts, previews and verification, start with [Contributing](CONTRIBUTING.md). Desktop previews are quiet and use disposable profiles; browser and ordinary desktop saves are separate.

## Play

Build a five-creature roster, deploying up to three ordinary creatures or one Legendary. Each ability has a base cost of 1 Mana. Recruit teammates, buy journey Boons and recover at Campfires between battles. Collection, keyword XP, talents and Gold persist between journeys. [Journey rules](Docs/EXPEDITION_DESIGN.md) explain formation, encounters and progression.

- Mouse: select cards and targets; hover over artwork for details; right-click pins inspection outside battle
- Keyboard: W/A/S/D navigate, Enter/Space activate, I inspects outside battle, Escape cancels or opens the menu; Tab remains available
- Standard controller: D-pad/left stick navigate, south confirms, east returns, west inspects outside battle and north ends the turn; prompts detect Xbox/Deck, PlayStation or Nintendo labels, with a manual override in [Settings](Docs/ui/screens.md#settings); non-standard mappings are unsupported

Accepted commands save automatically. Desktop close drains queued saves; abrupt browser/process termination cannot guarantee pending writes. See the [save contract](Docs/ARCHITECTURE.md#save-contract) and [development-save policy](AGENTS.md#development-saves).

## Guides

- [Contributing](CONTRIBUTING.md): setup, worktrees, verification and integration; [AGENTS.md](AGENTS.md): authorization and invariants
- [Architecture](Docs/ARCHITECTURE.md): runtime boundaries, commands and saving
- [Content](Docs/CONTENT.md), [creature design](Docs/CREATURE_DESIGN.md) and [Boon contracts](Docs/content/boons.md): authoring, artwork and mechanics
- [Keywords](Docs/KEYWORDS.md), [Glossary](Docs/GLOSSARY.md) and [Journey design](Docs/EXPEDITION_DESIGN.md): gameplay rules
- [UI](Docs/UI.md): shared appearance, accessibility and review; [menus](Docs/MENU_DESIGN.md), [screens](Docs/ui/screens.md) and [battle](Docs/ui/battle.md): affected flows
- [Development tools](Docs/DEVELOPMENT_TOOLS.md): previews, replay, balance and performance; [script map](scripts/README.md): implementations
- [Release](Docs/RELEASE.md): shipping gates and platform qualification
- [History](Docs/archive/README.md) and [design references](design/README.md): implementation records, measurements and scoped user choices

Alchemy informed the technology and some selected media; Fauna has its own implementation and no runtime dependency on Alchemy. Asset provenance lives in the manifest and linked source records.
