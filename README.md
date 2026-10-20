# Fauna

A single-player creature-collecting card battler for Steam. Choose a starter and recruit companions, combining their cards in one shared deck. Find combinations, recruit new teammates, and reach the heart of the wilds.

This foundation contains a complete short journey: choose one of five starter species, explore two biomes with three encounters and a boss each, collect keyword XP and currency, recruit reserves, choose journey Boons, and unlock Moonhart on victory. The illustrations are original procedural SVG placeholders, not final production artwork.

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

Inspect the available creatures, choose one starter, then begin the journey. Every creature contributes three cards. Keep up to seven cards in hand; each turn restores four Mana and draws four cards. Extra draws wait in a hidden, unplayable buffer and fill open hand slots in order as cards are played. End turn discards the visible hand and retains the buffer. Select a card and an enemy or ally; confirm team guard cards with Play. Enemy actions remain hidden. Block absorbs attacks, and each creature has a passive trait.

Knocked-out creatures cannot act; their cards retain inert slots until replaced by a swap. Defeat the enemy row to bank XP/currency. Health and knockouts persist between battles; Campfire appears beside destination choices whenever any roster creature, including a reserve or knockout, is missing at least 30% of maximum Health. Rest restores 30% maximum Health to the whole roster, capped at full Health, and returns to the same combat offers without advancing the encounter or changing RNG. It remains available while the threshold is met. The shared Victory screen offers recruitment after ordinary combat or Boon choices after intermediate bosses; choosing or skipping advances directly. Choose from the three defeated creatures, including species already owned, to build a five-creature roster. Each copy has its own battle state. Recruits fill the starting lineup up to three creatures, then join the two reserves. The starting lineup is remembered and optionally editable from the menu between battles. Swap freely during combat; incoming cards replace outgoing cards in their current zones without healing, drawing, or spending Mana. Healthy reserves can replace fallen creatures; defeat requires the entire roster to fall. Optional Merchants sell journey Boons for permanent Gold without replacing battles, appearing only when at least one item is affordable. Keyword XP unlocks shared permanent talents; talents can be bought or reset at any time through the menu. Defeating the boss unlocks Moonhart; losing or ending a run preserves discoveries.

- Mouse: select cards and targets. Right-click any card to inspect it.
- Keyboard: W/A/S/D navigate, Enter/Space activate, I inspects a focused card, Escape cancels or opens the menu. Tab remains available.
- Standard controller: D-pad/left stick navigate, south/A confirms, east/B backs out, west/X inspects, north/Y ends the turn. Button mapping follows standard Xbox-style positions. Non-standard mappings are not yet supported.

Gameplay settles before visual feedback. Accepted commands automatically save; a save failure exposes a retry action. Desktop close requests wait for queued saves. Browsers warn about closing while saves are pending, but abrupt browser/process termination cannot guarantee completion of queued writes.

## Verify

[Contributing](CONTRIBUTING.md#verification) owns the verification commands, local resource limits and CI policy. Default local checks cover bounded formatting and fixed Node smoke; full static, unit/DOM, build, browser and packaged Windows verification belong to CI. See [release boundaries](Docs/RELEASE.md) for the remaining shipping gates.

## Architecture and authoring

- [Development tools, previews, playthroughs and diagnostics](Docs/DEVELOPMENT_TOOLS.md)
- [Contribution workflow and verification](CONTRIBUTING.md)
- [Script implementation map](scripts/README.md)
- [Design references](design/README.md)
- [Planned Alchemy feature adoption](Docs/ALCHEMY_ADOPTION_PLAN.md)
- [Alchemy tools and platform adoption plan](Docs/ALCHEMY_PLATFORM_PLAN.md)
- [Architecture and saves](Docs/ARCHITECTURE.md)
- [Content and artwork](Docs/CONTENT.md)
- [UI and typography](Docs/UI.md)
- [Release and verification boundaries](Docs/RELEASE.md)

Alchemy informed the technology choices and architectural patterns. Fauna has its own implementation and no runtime dependency on Alchemy. Mana crystal UI sprites are adapted from Alchemy; provenance is recorded in the battle-layout sample README.
