# Menus and navigation — design decisions

Implemented direction from the design review.

- The main menu uses a centered primary button above a two-column grid of narrower secondary buttons on a black background, a simple Fauna title, and gameplay destinations only. No promotional copy, decorative panels or reward previews.
- Launching with a saved journey opens the main menu with Continue selected. Do not automatically resume gameplay.
- While a journey exists, offer Continue. End journey appears only in the hamburger pause menu and ends immediately without confirmation; Play appears only when no run exists.
- Opening the menu during an journey pauses play and shows a compact vertical dropdown anchored below and aligned to the right edge of its Open menu button, without dimming the current screen.
- Talents opens full screen from the menu. The header hamburger opens the originating main or pause menu directly, including from a talent tree. Escape/controller B returns through the talent overview to the originating menu while preserving the journey and its prior screen.
- Collection is available from the main and pause menus, including during battle, for reviewing permanently collected species, passives and action cards. It is separate from the journey roster.
- The header hamburger or Escape/controller B from Collection or the Talents overview returns to the originating main or pause menu with its Collection or Talents choice focused.
- Locked species show grayscale artwork, no unlock requirement, and no hover tooltip.
- Selecting a collected species opens a full creature page within Collection. Its artwork, active named trait and all three portrait abilities are visible together; each ability has its name, base Mana cost and full base rules outside the artwork. No hover or nested inspection is needed to read the kit. The page describes the species independently of journey card levels, talents and temporary battle modifiers. Rank progression is a native tab on the same page with one passive tier per page. Back and Escape/controller B return directly to the gallery with the same filter, page and creature focused. Open menu returns to the originating menu; battle Pause restores its Collection choice, and Continue resumes the unchanged battle with Auto-play off.
- Collection lists collected species first, followed by uncollected species. All, Collected and Uncollected tabs filter that list. Encountered species remain uncollected until recruited; the committed onboarding starter also joins Collection.
- Lineup is an optional centered dialog available from the menu between battles, including ordinary reward screens. It edits the saved starting three; combat swaps leave that preference unchanged. There is no mandatory team-selection destination.
- Journey results appear once when a journey is completed, defeated, or voluntarily ended; the main menu has no results entry. End journey on a started journey opens results; clearing an unfinished starter choice returns to the main menu.
- Settings and Glossary open full screen; the header hamburger and Escape/controller B return to the originating menu and restore its choice. Full screens use icon-only Back and Open menu buttons in balanced leading and trailing slots around the independently centered heading; the shared header frame is at most 640px wide. Back returns to the originating screen or menu; in a talent tree it returns to the overview.

Collection uses a centered title, tabs, a gallery and pagination. Back and Open menu occupy the leading and trailing slots of the shared balanced header frame. The gallery shows up to two rows of four creatures per page using the bounded artwork profiles; measured width reduces the column count before artwork is reduced. Pagination uses Previous and Next icon buttons without page counts. It reserves gallery and footer space so partial pages and filters keep controls stable. Each filter remembers its first visible creature while mounted. Changing capacity keeps that creature on the visible page, and shortened lists clamp the page. Locked species are noninteractive. Menu order is Continue/Play, optional Lineup between battles, Talents, Collection, Glossary, Settings, then End journey when applicable in Pause only. Pause also offers Main menu; desktop adds Save & quit.

See [UI rules](UI.md) and [journey design](EXPEDITION_DESIGN.md) for shared interaction and progression decisions.

## Shared menu treatment

Main and pause menus show the available talent-point count beside Talents with an accessible description; it updates from committed progression and disappears when spent. Main menu buttons are 180px wide, keeping labels on one line through 125% text size, with each icon and natural-width label centered together as a group with an 8px gap. Continue/Play sits centered above the two-by-two Talents, Collection, Glossary and Settings grid. Conditional choices add rows, with a lone final choice centered. Main menu buttons use uniform 12px horizontal and vertical gaps, including beneath the primary action. The pause menu is a 240px-wide shadcn Popover with one vertical list, left-aligned icons and labels, and 4px gaps between controls. It has no title, close icon or dimmed backdrop. Its surface and border use the shared overlay theme. Radix positions it 8px from the menu button and keeps it within the viewport when space is limited. Continue, clicking outside, or Escape/controller B dismisses it; focus returns to its opener. The main menu uses a default Button for Continue/Play and ghost Buttons for secondary choices; the dropdown uses ghost Buttons throughout. Use the charcoal/ivory/muted-gold semantic theme in `src/ui/tokens.css`. Settings keeps Display, Sound and Battle tabs, plus Steam Cloud on desktop. It uses Switch for Sound and Auto-end turn (in Battle), and RadioGroup for explicit text-size choices; changes save immediately. End journey appears only in the hamburger pause menu, with a red label and red Lucide LogOut icon, and commits immediately without confirmation.

## Battle assistance and reveals

The battle action group includes the labeled Auto-play Switch, initially off for each battle. Manual card selection stops it; ordinary menus pause it. Battle has no pinned inspection; hover/focus details remain available. Development battles include Skip combat beside Auto-play. Production contains no developer action.

A live creature unlock opens an artwork-centered Creature unlocked screen when leaving results, with ordinary kit inspection and Continue. Continue advances through pending reveals and then Main menu. It does not add inspection to Journey results.

Journey screens with headings use the same Back, heading and Open menu row. Back leaves Merchant or Campfire for the unchanged encounter without buying or resting, cancels recruit replacement before leaving Victory, returns from an unlock reveal to the main menu, and otherwise returns to the main menu without undoing committed gameplay. The root main menu keeps its Fauna title; battle has no main heading and retains its corner menu control.

## Journey decisions and inspection

Drafting, encounter, Victory, Merchant and Campfire headings offer the same icon-only Deck control beside Back, with the title centered independently of the side controls. It opens the shared Deck inspection without committing gameplay; drafting previews the action cards contributed by the already chosen starters. Closing restores the Deck opener.

When the roster is full, recruit replacement keeps the incoming recruit visible and inspectable beside the paginated existing roster. Only activating a Release choice commits recruitment. Back or Cancel restores the original offer and its focus. Inspecting or paging never releases a creature.

Settings uses a compact 640px maximum width and reserves the tallest category’s natural height in one grid cell. Inactive native tab panels stay invisible, inert and hidden from assistive technology so changing tabs preserves the heading and tabs without exposing inactive controls.
