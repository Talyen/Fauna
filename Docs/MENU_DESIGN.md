# Menus and navigation

This guide owns routes, actions and focus return. [Screen specifications](ui/screens.md) own composition; [UI contracts](UI.md) own shared interaction behavior. Navigation never changes game revision or undoes committed gameplay.

## Menu actions

Launch opens Main menu, selecting Continue when a journey exists; never resume automatically. Offer Play only without a journey, Continue while one exists.

Menu order is Continue/Play, Talents, Collection, optional owned Boons during a journey, Glossary and Settings. Pause also offers Main menu and End journey; desktop adds Save & quit. End journey is immediate, without confirmation, and appears only in Pause.

Collection, Talents, Settings and Glossary open full screen from either menu, including during battle. The hamburger opens the originating menu directly, even from a talent tree. Menus pause Auto-play; returning from Collection leaves it off. Main menu preserves the saved journey; Continue resumes its committed state.

[Journey rules](EXPEDITION_DESIGN.md#screen-flow-and-journey-results) own End journey outcomes and reward settlement. Results have one Main menu action and no menu entry for reopening them.

## Back and focus return

| Surface                                           | Back / Escape / controller B                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Pause                                             | Dismiss to its opener                                                                               |
| Collection, Settings, Glossary, Talents overview  | Restore the originating menu and its corresponding choice                                           |
| Talent tree                                       | Return to the overview; the hamburger still opens the originating menu directly                     |
| Creature-parent action inspection                 | Return to the creature and focus the current thumbnail; a second Back closes to the original opener |
| Direct hand/deck action inspection                | Close to its opener, without creating a creature parent                                             |
| Boon Merchant shelf or purchased reward           | Complete the room and prepare fresh destinations                                                    |
| Campfire                                          | Leave without Rest, preserving the encounter                                                        |
| Unchosen recruitment                              | Return home without changing saved offers                                                           |
| Team confirmation / required knockout replacement | No Back/Cancel bypass; complete the required choice                                                 |
| Other journey screens                             | Return home without reversing committed gameplay                                                    |

Inspection X/outside click closes the entire Dialog. Nested surfaces own their focus and restore a connected, enabled opener; otherwise use the current-screen fallback. Inspection returns Collection to the same filter, page and creature. Opening child menu dialogs replaces Pause so only one trap owns focus. The mandatory replacement Dialog ignores Escape/outside click.

Journey headings offer read-only Deck inspection; closing restores the Deck opener. During drafting, Deck reflects already chosen starters. [Screen headings](ui/screens.md#screen-headings) own geometry and control placement.

## Battle and external pause

Battle has no pinned inspection: right-click, I and controller X do not open it. Hover/focus details remain available. Escape/controller B cancels targeting first, then opens Pause. Manual card selection stops Auto-play; its per-battle control starts off. Development alone exposes Skip combat beside Auto-play, through the explicit session capability.

Steam overlay activation revokes commands, preserves higher-priority inspection, clears targeting, stops Auto-play and opens Pause. Closing the overlay does not resume automatically. Held confirmation must be released before acting again. [Input rules](UI.md#interaction-states-and-accessibility) own modality/reconnect behavior; [Architecture](ARCHITECTURE.md#cloud-reconciliation-and-device-preferences) owns native admission.
