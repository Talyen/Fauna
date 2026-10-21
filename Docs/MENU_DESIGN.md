# Menus and navigation — design decisions

Implemented direction from the design review.

- The main menu uses a centered primary button above a two-column grid of narrower secondary buttons on a black background, a simple Fauna title, and gameplay destinations only. No promotional copy, decorative panels or reward previews.
- Launching with a saved journey opens the main menu with Continue selected. Do not automatically resume gameplay.
- While a journey exists, offer Continue/Resume. End journey appears only in the hamburger pause menu and ends immediately without confirmation; New journey appears only when no run exists.
- Opening the menu during an journey pauses play and shows a centered overlay over the current screen.
- Talents opens full screen from the menu. The header hamburger opens the originating main or pause menu directly, including from a talent tree. Escape/controller B returns through the talent overview to the originating menu while preserving the journey and its prior screen.
- Collection is a main-menu destination for reviewing permanently collected species, passives and action cards. It is separate from the journey roster.
- The header hamburger or Escape/controller B from Collection or the Talents overview returns to the originating main or pause menu with its Collection or Talents choice focused.
- Locked species show grayscale artwork, no unlock requirement, and no hover tooltip.
- Clicking a collected species opens the centered inspection dialog: creature artwork and three portrait action thumbnails alongside paginated passive tiers. Names, health, passives, and ability rules appear on hover or keyboard/controller focus, with no artwork captions. Selecting a thumbnail pins its artwork in the same dialog; its rules remain on hover/focus. A/D and controller left/right cycle actions without Previous/Next buttons. A visible Back control and Escape/controller B return to the species and its current thumbnail, then close inspection and restore the collection opener.
- Collection lists collected species first, followed by uncollected species. All, Collected and Uncollected tabs filter that list. Encountered species remain uncollected until recruited; the committed onboarding starter also joins Collection.
- Lineup is an optional centered dialog available from the menu between battles, including ordinary reward screens. It edits the saved starting three; combat swaps leave that preference unchanged. There is no mandatory team-selection destination.
- Journey results reopens the most recent completed, defeated, or voluntarily ended journey until starting a new one. End journey on a started journey opens results; clearing an unfinished starter choice returns to the main menu.
- Settings and Glossary open full screen; the header hamburger and Escape/controller B return to the originating menu and restore its choice. Full screens use an icon-only Open menu hamburger to the right of the centered header, with no visible Back button.

Collection uses a centered title, tabs, a gallery and pagination. The Open menu hamburger sits to the right of the centered heading. The gallery shows two rows of four creatures per page using the bounded artwork profiles. Pagination uses Previous and Next icon buttons without page counts. It reserves gallery and footer space so partial pages and filters keep controls stable. Changing filters starts at the first page. Locked species are noninteractive. Menu order is Continue/New journey, optional Lineup between battles, Talents, Collection, Glossary, Settings, then End journey when applicable in Pause only. Pause also offers Main menu; desktop adds Save & quit.

See [UI rules](UI.md) and [journey design](EXPEDITION_DESIGN.md) for shared interaction and progression decisions.

## Shared menu treatment

Main menu buttons are 190px wide, with Continue/New journey centered above the two-by-two Talents, Collection, Glossary and Settings grid. Conditional choices add rows, with a lone final choice centered. All main menu buttons use uniform 12px horizontal and vertical gaps, including beneath the primary action. Pause keeps its centered vertical list. Both menus use shadcn default Button for Continue, New journey, or Resume; ghost Buttons for other choices. Use the charcoal/ivory/muted-gold semantic theme in `src/ui/tokens.css`. Settings keeps Display, Sound and Battle tabs, plus Steam Cloud on desktop. It uses Switch for Sound and Auto-end turn (in Battle), and RadioGroup for explicit text-size choices; changes save immediately. End journey appears only in the hamburger pause menu, with a red label and red Lucide LogOut icon, and commits immediately without confirmation.

## Battle assistance and reveals

The battle action group includes the labeled Auto-play Switch, initially off for each battle. Manual card selection stops it; ordinary menus and inspection pause it. Development battle pause menus include Skip combat below the normal menu actions. Production menus contain no developer action.

A live creature unlock opens an artwork-centered Creature unlocked screen when leaving results, with ordinary kit inspection and Continue. Continue advances through pending reveals and then Main menu. It does not add inspection to Journey results.
