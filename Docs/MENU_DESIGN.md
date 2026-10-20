# Menus and navigation — design decisions

Implemented direction from the design review.

- The main menu uses a centered vertical list on a black background, a simple Fauna title, and gameplay destinations only. No promotional copy, decorative panels or reward previews.
- Launching with a saved journey opens the main menu with Continue selected. Do not automatically resume gameplay.
- While an journey exists, offer Continue/Resume and End journey. End journey requires confirmation; New journey appears only when no run exists.
- Opening the menu during an journey pauses play and shows a centered overlay over the current screen.
- Talents opens full screen from the menu. Back/Escape returns to the pause menu while preserving the journey and its prior screen.
- Collection is a main-menu destination for reviewing permanently unlocked species, passives and action cards. It is separate from the journey roster.
- Locked species show grayscale artwork, no unlock requirement, and no hover tooltip.
- Clicking an unlocked species opens the centered stacked inspection dialog: creature artwork, passive, and three portrait action thumbnails. Hover/focus shows final rules; selecting a thumbnail opens its enlarged view in the same dialog. A/D or Previous/Next cycles actions. Back/Escape returns to the species and its current thumbnail.
- Collection lists unlocked species first, followed by locked species.
- Lineup is an optional centered dialog available from the menu between battles, including ordinary reward screens. It edits the saved starting three; combat swaps leave that preference unchanged. There is no mandatory team-selection destination.
- Journey results reopens the most recent completed, defeated, or voluntarily ended journey until starting a new one. End journey on a started journey opens results; clearing an unfinished starter choice returns to the main menu.
- Settings and Glossary open as centered dialogs; closing them returns to the menu.

Collection uses a responsive artwork grid. Locked species are noninteractive. Menu order is Continue/New journey, optional Lineup between battles, Talents, Collection, Glossary, Settings, then End journey when applicable. Pause also offers Main menu; desktop adds Save & quit.

See [UI rules](UI.md) and [journey design](EXPEDITION_DESIGN.md) for shared interaction and progression decisions.

## Shared menu treatment

Main and pause menus use the same centered vertical list: shadcn default Button for Continue, New journey, or Resume; ghost Buttons for other choices. Use the charcoal/ivory/muted-gold semantic theme in `src/ui/tokens.css`. Settings uses Switch for Sound and RadioGroup for explicit text-size choices; changes save immediately. End journey uses AlertDialog with Cancel focused initially and no outside-click dismissal.
