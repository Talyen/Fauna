# Menus and navigation — design decisions

Implemented direction from the design review.

- The main menu uses a centered vertical list on a black background, a simple Fauna title, and gameplay destinations only. No promotional copy, decorative panels or reward previews.
- Launching with a saved expedition opens the main menu with Continue selected. Do not automatically resume gameplay.
- While an expedition exists, offer Continue/Resume and End run. End run requires confirmation; New expedition appears only when no run exists.
- Opening the menu during an expedition pauses play and shows a centered overlay over the current screen.
- Talents opens full screen from the menu. Back/Escape returns to the pause menu while preserving the expedition and its prior screen.
- Collection is a main-menu destination for reviewing permanently unlocked species, passives and action cards. It is separate from the expedition roster.
- Locked species show grayscale artwork, no unlock requirement, and no hover tooltip.
- Clicking an unlocked species opens the centered inspection dialog for its passive and action cards.
- Collection lists unlocked species first, followed by locked species.
- Settings and Glossary open as centered dialogs; closing them returns to the menu.

Collection uses a responsive artwork grid. Locked species are noninteractive. Menu order is Continue/New expedition, Talents, Collection, Glossary, Settings, then End run when applicable. Pause also offers Main menu; desktop adds Save & quit.

See [UI rules](UI.md) and [expedition design](EXPEDITION_DESIGN.md) for shared interaction and progression decisions.
