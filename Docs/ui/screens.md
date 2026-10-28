# Screen specifications

[UI contracts](../UI.md) own shared controls, layout, accessibility and rendered review; [journey design](../EXPEDITION_DESIGN.md) owns progression. This guide owns screen composition, navigation and focus return. Read the affected screen and the shared [focus/availability](../UI.md#interaction-states-and-accessibility), [scrolling](../UI.md#layout-artwork-size-and-spacing) and [presentation lifetime](../UI.md#presentation-lifetime) rules.

## Navigation and menus

Navigation never changes game revision or undoes committed gameplay.

### Menu actions

Launch opens Main menu, selecting Continue when a journey exists; never resume automatically. Offer Play only without a journey, Continue while one exists.

Menu order is Continue/Play, Talents, Collection, optional owned Boons during a journey, Glossary and Settings. Pause also offers Main menu and End journey; desktop adds Save & quit. End journey is immediate, without confirmation, and appears only in Pause.

Collection, Talents, Settings and Glossary open full screen from either menu, including during battle. The hamburger opens the originating menu directly, even from a talent tree. Menus pause Auto-play; returning from Collection leaves it off. Main menu preserves the saved journey; Continue resumes its committed state.

[Journey rules](../EXPEDITION_DESIGN.md#screen-flow-and-journey-results) own End journey outcomes and reward settlement. Results have one Main menu action and no menu entry for reopening them.

### Back and focus return

| Surface                                                 | Back / Escape / controller B                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Pause                                                   | Dismiss to its opener                                                                                              |
| Collection, Settings, Glossary, Talents overview        | Restore the originating menu and its corresponding choice                                                          |
| Talent tree                                             | Return to the overview; the hamburger still opens the originating menu directly                                    |
| Creature-parent action inspection                       | Return to the creature and focus the current thumbnail; a second Escape/controller B closes to the original opener |
| Direct hand/deck action inspection                      | Close to its opener, without creating a creature parent                                                            |
| Boon Merchant shelf or purchased reward                 | Complete the room and prepare fresh destinations                                                                   |
| Campfire                                                | Leave without Rest, preserving the encounter                                                                       |
| Unchosen recruitment                                    | Return home without changing saved offers                                                                          |
| Full-roster recruitment / required knockout replacement | No Back/Cancel bypass; complete the required choice                                                                |
| Other journey screens                                   | Return home without reversing committed gameplay                                                                   |

Inspection has no visible Back button; X/outside click closes the entire Dialog overlay. Nested surfaces own their focus and restore a connected, enabled opener; otherwise use the current-screen fallback. Inspection returns Collection to the same filter, page and creature. Opening child menu dialogs replaces Pause so only one trap owns focus. The mandatory replacement Dialog ignores Escape/outside click.

Journey headings offer read-only Deck inspection; closing restores the Deck opener. During drafting, Deck reflects already chosen starters. [Screen headings](#screen-headings) own geometry and control placement.

### Battle and external pause

Battle has no pinned inspection: right-click, I and controller X do not open it. Hover/focus details remain available. Escape/controller B cancels targeting first, then opens Pause. Manual card selection stops Auto-play; its per-battle control starts off. Development alone exposes Skip combat beside Auto-play, through the explicit session capability.

Steam overlay activation revokes commands, preserves higher-priority inspection, clears targeting, stops Auto-play and opens Pause. Closing the overlay does not resume automatically. Held confirmation must be released before acting again. [Input rules](../UI.md#interaction-states-and-accessibility) own modality/reconnect behavior; [Architecture](../ARCHITECTURE.md#cloud-reconciliation-and-device-preferences) owns native admission.

## Screen headings

Apply the [copy and layout rule](../UI.md#copy-and-layout) throughout these screens; headings and action placement must make the flow clear without taglines, helper text or secondary labels.

Use a balanced header frame up to 640px wide (920px for the Merchant wallet and translated title): Back leads, Open menu trails, and the title centers independently. Journey screens add Deck beside Back, with a 12px gap and equal side reservations. Deck follows [menu inspection rules](#back-and-focus-return), previewing chosen starters during drafting.

Header and battle corner controls use 32px visible surfaces and 16px icons within 44px hit areas. Use 24px section gaps. Main menu keeps its Fauna title; battle has no main heading. Team confirmation omits Back.

## Main menu and Pause

Main menu places a gold default Continue/Play Button above a two-column grid of ghost Talents, Collection, Glossary and Settings Buttons. Conditional choices add rows; center a lone final choice. Buttons are 180px wide at default text size and grow with enlarged text, with 12px gaps. Center each icon/natural-width label group with an 8px gap. Show no promotional copy, decorative panels or reward previews.

Pause is a 240px-wide shadcn Popover, aligned below/right of Open menu with an 8px gap and viewport collision handling. Use ghost Buttons in one left-aligned icon/label list with 4px gaps. There is no title, close icon or dimmed backdrop. Continue, outside click or Escape/controller B dismisses it and returns focus.

Both menus show spendable talent points beside Talents with an accessible description; the count disappears when spent. End journey uses a red label and LogOut icon in Pause only. [Menu design](#menu-actions) owns action availability and order.

## Starter draft

Show up to three distinct offers at shared artwork sizes. Activating creature artwork recruits immediately; hover/focus shows the passive, and right-click, I or the controller inspection action opens the full kit without recruiting. Each card has an accessible Recruit name. Omit separate Recruit and Begin journey buttons: [starter rules](../EXPEDITION_DESIGN.md#roster-and-battles) own automatic start, saved choices, pools and Legendary eligibility.

Shared creature hover/focus details show the creature name as the header, the passive trait name with a sparkle icon, and the current passive rules. Trait names and icons share the short-label shine palette from keywords in the passive rules; rules retain solid keyword colors. Omit rarity labels, Block, status effects, kit labels and ability lists. Live combatants with readouts also append current/maximum Health, including inspectable backups; starter and Collection artwork have no live Health readout. Echo minions have no passive; their tooltip contains their name and live Health when readouts are enabled.

## Creature and action inspection

Outside battle, use one centered shadcn Dialog panel over the shared dimmed backdrop, keeping the originating screen visible beneath it. Center the creature name above a row of three native portrait abilities with 12px gaps; omit the creature's base artwork. Show the current named trait, five progress stars and active passive description below. Stars fill left to right from zero to five; no rank controls or separate rank view appear. Ability names and rules are available through hover or intentional navigation focus. Keep accessible dialog titles.

[Inspection CSS](../../src/ui/inspection/inspection.css) fits the ability row to the panel width and remaining viewport height, capped by the 184px `--inspection-ability-max-width` per portrait. Keep the common center axis and [shared layout constraints](../UI.md#layout-artwork-size-and-spacing).

Activating a thumbnail pins its enlarged artwork in the same Dialog. A/D and controller left/right cycle the three actions without Previous/Next buttons. Card rules show final effects without a bonus breakdown or embedded Glossary definitions. Inspection has no Recruit/Choose action.

[Back and focus return](#back-and-focus-return) owns inspection nesting and dismissal; the accessible X is named Close inspection. Battle, piles opened in battle and required replacement use hover/focus details without nested pinned inspection. Enemy tooltips follow the shared creature tooltip contract and never reveal intents; full species kits belong in Collection.

## Collection

Use a centered title, All/Collected/Uncollected tabs, a gallery and pagination. Order collected species first. Collected artwork shows five external progress stars; name/details appear on hover/focus and activation opens the shared inspector. Uncollected artwork rests in grayscale, with no tooltip, kit details or unlock requirement. Browsing never grants discovery.

Uncollected artwork reveals its colors and keyword shine on hover or intentional keyboard/controller focus, returning to grayscale at rest; it cannot be activated. The inspector uses base species abilities without journey upgrades, talents or combat modifiers; permanent passive rank still applies. It has no separate ability/rank tabs. Collection remains available from battle Pause; returning preserves combat and leaves Auto-play off.

Reserve two gallery rows and a footer slot. Measured width chooses one to four columns independently of item count before reducing artwork. Previous/Next icon buttons have accessible names but no tooltips or page counts. Hide unavailable arrows while reserving their space; if a focused arrow disappears, focus the remaining arrow or the filter when neither remains.

Each filter remembers its first visible creature while mounted. Resize keeps that anchor on a visible page; shorter lists clamp the page. Inspection returns to the same filter, page and creature focus. Paging is instant.

## Talents

The overview shows every category in centered rows of at most five, with 12px column gaps. Portrait artwork grows to the largest size fitting row width and remaining height, without a fixed cap. Reserve full-size category names (16px) and available-point labels (13px), respecting text preferences and fixed caption line boxes. If no category has points, omit the empty point-label space.

Selecting artwork opens a dedicated tree. Show available points, exact XP and Progress above compact icon/name cards with visible effects and availability requirements. Authored rows contain two talents, with a possible single final talent. Measure remaining height to page up to three rows. The category-named header reset immediately refunds that category and is disabled without allocations. Purchases are immediate; definitions belong to the gameplay catalog.

Owned borders are gold. Unavailable talent cards keep their rules and requirements readable, with availability indicated by their status and icon treatment. Icons use keyword color at 65% while unowned and full strength when owned, without checkmarks. Only available icons brighten 20% on hover, without growth. Ownership transitions over 150ms; purchase flashes the existing border gold then fades over 250ms. Focus takes priority over the flash; shared availability rules distinguish missing points from incomplete earlier rows.

## Victory, recruitment and team replacement

### Earnings and choices

Show battle earnings above the Recruit offers: keyword-colored icons/level labels with compact progress bars, then a separate Gold row. An unchosen recruitment resumes directly to these offers; a banked full-roster recruit resumes directly at the replacement choice.

[Reward rules](../EXPEDITION_DESIGN.md#recruitment) own the exact defeated-species offers and boss cadence. Recruitment has no Skip. Activating starter or reward artwork recruits immediately; hover or focus shows details and the inspection shortcut opens the full kit without recruiting. A first Collection unlock uses a small New! chip; otherwise show five stars, with earned ranks filled and the incoming star outlined with a plus. At maximum rank show five filled stars without a caption. Keep the group compact without unused pagination space. Boon choices retain their reserved choice area, external names and hover/focus effects; choose or Skip advances directly. An empty Boon pool advances automatically.

### Replace a creature

For a full roster, center the incoming artwork and opposing-arrow icon above one quiet Team tray of all five current individuals. Omit at-rest names, Health, pagination, Back and Cancel; hover/focus and inspection retain details.

Activating an existing creature immediately replaces it with the incoming recruit. Keep team immediately preserves the current roster. Hover and inspection do not change the roster. [Recruitment rules](../EXPEDITION_DESIGN.md#recruitment) own banking and reload behavior.

## Journey results

Show only outcome and permanent gains. Keywords use names, levels (earned points + 1) and progress bars without numeric XP gains/fractions or talent-point prompts. Omit teams, unlocks, statistics and temporary Boons. One centered Main menu action leaves results; there is no menu entry to reopen them. [Journey results](../EXPEDITION_DESIGN.md#screen-flow-and-journey-results) own banking and ending behavior.

## Encounter and required replacement

Show a quiet encounter number out of eight and keep compact last-battle earnings visible until the next battle begins. Ordinary combat uses one blank landscape ArtCard labeled Combat. Boss entrances show the authored name/species artwork and base-trait hover/focus details. Activating either starts the saved battle directly, without previews or visible intents. Keep Deck available. No free Swap or Lineup control appears.

When exactly one living backup can replace a knockout, dispatch that replacement immediately. When multiple backups are available, show a centered, nondismissible Choose a replacement Dialog. Put the knocked-out creature above living backup at shared sizes, separated by an up/down icon. Only backup choices commit, immediately. Focus the first living choice; repeat only while a choice remains, then focus returns to the hand or End turn. Escape/outside click cannot bypass the choice. Backup stays hidden on the battlefield. [Replacement rules](../EXPEDITION_DESIGN.md#knockout-replacement-and-ability-swaps) own resume.

## Optional Recruit destination

Show creature artwork, Recruit and its species name. Its hover/focus details follow the shared creature tooltip contract. Activating the destination recruits directly, without a separate confirmation or roster-release step. [Journey rules](../EXPEDITION_DESIGN.md#recruitment) own eligibility and committed outcomes.

## Settings

Use a centered full screen up to 640px wide, native Display/Sound/Battle tabs and a stable header/tab row. Mounted inactive panels reserve the tallest category's natural height and remain invisible, inert and hidden from assistive technology. Do not add a fixed minimum or panel fade/movement. Use the shared secondary-scrolling recipe for long panels.

Use distinct Lucide icons, the shared 24px bold uppercase screen title, body-size uppercase pale-gold section headings with fading rules, 16px light option labels and muted supporting text. Align labels/controls in columns and values to control edges; wrap controls below labels when needed. Shared control styling belongs to [UI contracts](../UI.md#shared-control-states-and-feedback).

| Category             | Controls                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Display              | Language choice when more than one language is qualified; independent Text size and Tooltip size radios: 75%, 100%, 125%, default 100%; Background Glow and Background Particles: 0–100%, default 100% |
| Sound                | Sound switch, Master/Music/Sound effects sliders with percentage readouts in 10-point steps (all default 50%), Mute in background                                                                      |
| Battle               | Auto-end turn switch, enabled by default; Controller prompts radios: Automatic (default), Xbox / Deck, PlayStation, Nintendo                                                                           |
| Desktop Display only | Windowed/Fullscreen radios reflecting confirmed native state                                                                                                                                           |

Language opens a dialog with Automatic and qualified languages named in their own languages. Selecting a language applies immediately without closing the dialog; Escape or controller Back closes it and returns focus to the language control. Automatic uses Steam's game language when available, then system preferences, with English fallback. The choice is device-local and does not alter a journey. Do not offer incomplete languages; [localization qualification](../LOCALIZATION.md#implementation-and-qualification) owns the remaining requirements.

Controller prompts detect known browser device IDs; Steam Input may expose an Xbox identity for another controller, so manual selection takes precedence. Standard gamepad button positions remain unchanged. Losing the controller currently being used stops autoplay and opens pause during play; reconnecting does not resume.

Changes persist immediately outside progression and Cloud. Tooltip size changes tooltip type/width without scaling artwork. Sound changes apply live without replaying actions. Sliders retain native keyboard behavior; W/A/S/D and controller navigation adjust horizontally and move between rows vertically.

Cloud and diagnostics have no Settings surface, status or Retry control. [Recovery policy](../UI.md#recovery-and-persistent-failures) owns player consequences. Native fullscreen/overlay acceptance belongs to [Release](../RELEASE.md).

## Glossary

Use the shared secondary-scrolling recipe, keeping menus and Back outside the reading region and its final rule reachable. Definitions come from the [gameplay glossary](../KEYWORDS.md#glossary-and-terminology).

## Deck, piles and owned Boons

Deck and owned Boons use the existing modal owner and bounded pages. Draw/Discard Piles use shared portrait ArtCards beside the hand and open Deck-style viewers with accessible inspection names and empty states. Sort cards by definition/instance identity, never draw order; browsing follows the [read-only inspection contract](#back-and-focus-return). Battle viewers use hover/focus details without nested action inspection.

## Campfire

The Campfire destination uses location artwork with Rest beneath it. Inside the visit, page the whole roster on one measured row, showing current Health and exact capped recovery before a single Rest action. Use the [eligibility and recovery rules](../EXPEDITION_DESIGN.md#campfire).

Rest returns immediately to the same combat offers, briefly presenting committed before/after meters and actual recovery for healed creatures, including backup. Navigation and battle remain available; reduced motion shows final meters.

## Boon Merchant

Open directly from its existing landscape location ArtCard; source selection remains an explicit placeholder. Center up to three prepared portrait Boons with names/rules/journey duration in hover/focus details. Put the Gold wallet in the heading row, the one-per-visit limit in offer details and the price below each artwork. Activating affordable artwork purchases immediately; center Leave. Wallet/prices use shared gold Coins icons.

Unaffordable purchases remain focusable, explain Not enough Gold and cannot issue commands. Buying returns directly to the encounter screen and briefly shows the purchased Boon and its price without blocking the next action. A committed purchase resumes by leaving the Merchant without buying again. [Support visits](../EXPEDITION_DESIGN.md#optional-support-visits) own purchase commitment, resume, prices, eligibility, leaving and rerolls.

## Startup loading

The HTML shell shows an uppercase filling gold Fauna wordmark, independent blowing leaves and rotating preparation phrases before importing React. Keep the same mounted splash through startup. It lasts at least five seconds from navigation start, then fades over 180ms after the ready app commits. Reduced motion keeps a gold wordmark, hides leaves, stops phrase rotation and removes fade while retaining minimum duration. Saved text size applies before first paint.

Startup validates bundled content once before loading the session. Invalid content never reaches save loading. A fatal preparation failure immediately keeps the same splash with a static gold wordmark and the accessible message Fauna could not start; hide leaves, stop phrase rotation and animation, and clear its busy state. The success-only minimum duration does not delay failure. Disposal prevents a late reveal or failure message; [recovery policy](../UI.md#recovery-and-persistent-failures) owns the boundary.

Fetch/decode menu/shared artwork and the saved journey's immediate screen in batches of four before reveal. Warm at most eight owned/offered ability images beyond that screen without gating play or inspecting hidden draw order; selection changes, backgrounding and disposal cancel obsolete preparation. Retain essential references until the ready screen commits, without keeping a whole-catalog decoded cache. Image/decode waits settle after 15 seconds, fonts after 10, recording failures internally. Presentation recovery retains the session and uses ordinary neutral loading without repeating startup. [Resource efficiency](../RESOURCE_EFFICIENCY.md#artwork-preparation) owns measurement and maintenance.
