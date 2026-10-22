# Pre-battle team selection review sample

Historical alternative: production has a five-creature roster, optional Lineup management between battles and direct encounter entry. It has no mandatory pre-battle team-selection screen. See [roster decisions](../../Docs/EXPEDITION_DESIGN.md#roster-and-battles).

Open `/design/team-selection/index.html` on the development server. Frozen presentation fixtures only; no gameplay session, saves or progression. Uses a full six-species roster to review maximum layout capacity, including Prismram as a placeholder regardless of real unlock state.

Enemies are above separate active and reserve rows. Select one creature in either roster row, then one in the other row to swap. Selecting the same creature cancels; another creature in the same row changes the selection. Escape cancels. A/D navigates within a row; W/S changes rows; Enter selects; I or right-click opens centered inspection. Hover/focus reveals details. Deck opens the active team's nine cards, with hover/focus rules. Begin battle locks the local sample selection and ends the preview; it does not launch combat. Reload to reset.

This sample exercises mouse and keyboard only. Physical controller input is not implemented or verified here. Artwork remains 4:3 landscape for creatures and 3:4 portrait for action cards.
