# Battle Swap review sample

Open `/design/battle-swap/index.html` on the development server. Add `?open=1` to start with the dialog open, or `?open=1&ko=1` to review replacing a knocked-out deployed creature.

This is a presentation sandbox with local state only. It uses the production BattleScreen, CreatureCard, ArtCard, ManaCrystals, and registered shadcn Dialog and Button components. It does not modify saves, implement the production combat swap command, or advance combat. Reload resets the fixture.

Swap sits beside End turn; reserves remain hidden on the battlefield. The centered dialog contains three deployed creatures and two smaller reserves. Select either group first; selecting the other group commits immediately and closes the dialog. Clicking the selected creature clears selection; selecting another in the same group changes selection. Escape, the close button, and outside click dismiss the standard dialog. Tab navigation and focus return use Radix behavior. Creature details use hover/focus tooltips; artwork has no overlays and retains its 4:3 composition. Health bars remain outside artwork.

The local preview replaces card definitions in place while preserving card IDs and hand/draw/discard positions. Swaps are free; health and combat data stay with the creature. This is not validation of production save, knockout circulation, passive, or defeat rules.

This sample retains the earlier free-swap and editable-lineup direction. Production at `/` now changes formation only through required knockout replacements and abilities, persists that formation into later battles, and supports solo Legendaries. Its required replacement dialog cannot be dismissed while living backup remain. See [current journey rules](../../Docs/EXPEDITION_DESIGN.md#roster-and-battles) and [UI rules](../../Docs/UI.md#other-screens); this frozen sample does not validate those flows.

Reviewed in Chromium at 1920×1080 and 1280×800, including selection in either order, repeated swaps, replacing a knocked-out creature, Escape dismissal, focus restoration, and unchanged Mana. Native desktop, Windows, physical controller, Steam client, and Steam Deck were not verified for this sample.
