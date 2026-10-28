# Brumalyn

The user selected Winter’s Reprieve, Warmth Ward, Rime Pounce and Frost Howl on October 28, 2026. The [authored kit](../../../src/game/content/creatures/brumalyn.ts) owns Health, exact rules and all six passive tiers. Brumalyn is an ordinary recruitable creature outside the first-run starter pool

## Winter’s Reprieve

When a living deployed ally causes an opposing creature to become Frozen, each living deployed friendly creature restores the provider's current passive amount. This includes allied Minions; Camp Hammock extends automatic healing to living allied backups. Every living deployed provider contributes independently; enemy providers use the base tier, never the player's Collection rank. Knocked-out and backup providers do not contribute

The trigger is successful control, including independently applied and reflected Freeze, not a Freeze hit or buildup alone. It does not occur for immunity, active control, an already defeated target, natural recovery or Stun. Healing follows ordinary received-healing modifiers and caps, does not revive, and is not card healing. A provider that falls or departs during reactions stops contributing. No new saved counters are needed

## Abilities

All abilities cost one Mana. Warmth Ward restores its primary amount to all living allies, then Cleanses Freeze buildup from living deployed allies; active Freeze and other statuses remain. Camp Hammock can extend the healing but does not extend the buildup Cleanse. The healing value upgrades normally and scales with enemy power; the thaw is fixed

Rime Pounce deals single-target Freeze damage. Frost Howl makes one equally weighted seeded choice between Freeze and Stun for each resolution, then applies that same damage type to all enemies. Repeated resolutions make separate choices. Both damage types receive their ordinary effects, defenses, experience and previews. Enemy creatures use the same three definitions and the base passive

## Artwork

The [Drive folder](https://drive.google.com/drive/folders/1-WgIiUo4yfENVBIQajZQNFzbDMGhk8PQ) contains the unchanged portrait and selected second-generation action images. The [manifest](../../../assets/manifest.json) records each source and its retained original. Brumalyn’s packed lynx and lantern suggest a mountain guide who brings warmth and respite; its ice pounce and upward howl express the two attacks

## Verification

[Focused combat regressions](../../../tests/unit/game/creatures/brumalyn.test.ts) cover the selected cards, tiered healing, trigger exclusions, enemy behavior, random type, preview and save/resume. Balance estimates, rendered review, hosted CI and platform qualification are separate evidence
