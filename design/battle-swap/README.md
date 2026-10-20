# Battle Swap review sample

Open `/design/battle-swap/index.html` on the development server. Add `?open=1` to start with the dialog open, or `?open=1&ko=1` to review replacing a knocked-out deployed creature.

This is a presentation sandbox with local state only. It uses the production BattleScreen, CreatureCard, ArtCard, ManaCrystals, and registered shadcn Dialog and Button components. It does not modify saves, implement the production combat swap command, or advance combat. Reload resets the fixture.

Swap sits beside End turn; reserves remain hidden on the battlefield. The centered dialog contains three deployed creatures and two smaller reserves. Select either group first; selecting the other group commits immediately and closes the dialog. Clicking the selected creature clears selection; selecting another in the same group changes selection. Escape, the close button, and outside click dismiss the standard dialog. Tab navigation and focus return use Radix behavior. Creature details use hover/focus tooltips; artwork has no overlays and retains its 4:3 composition. Health bars remain outside artwork.

The local preview replaces card definitions in place while preserving card IDs and hand/draw/discard positions. Swaps are free; health and combat data stay with the creature. This is not validation of production save, knockout circulation, passive, or defeat rules.

The actual game now implements this direction at `/`: five roster members, three deployed; remember the starting lineup rather than randomize it every battle. Offer optional Lineup management from the expedition menu between battles with no mandatory selection prompt. Only deployed living creatures supply passives; defeat occurs when the entire roster is knocked out. This frozen sample still uses local presentation state; play the actual game to exercise saves and progression.

Reviewed in Chromium at 1920×1080 and 1280×800, including selection in either order, repeated swaps, replacing a knocked-out creature, Escape dismissal, focus restoration, and unchanged Mana. Native desktop, Windows, physical controller, Steam client, and Steam Deck were not verified for this sample.
