# Screen specifications

[UI contracts](../UI.md) own shared controls, layout, accessibility and rendered review. [Menu design](../MENU_DESIGN.md) owns navigation and Back; [journey design](../EXPEDITION_DESIGN.md) owns progression. Read only the affected screen below; shared [focus/availability](../UI.md#interaction-states-and-accessibility), [scrolling](../UI.md#layout-artwork-size-and-spacing) and [presentation lifetime](../UI.md#presentation-lifetime) rules apply throughout.

## Screen headings

Apply the [copy and layout rule](../UI.md#copy-and-layout) throughout these screens; headings and action placement must make the flow clear without taglines, helper text or secondary labels.

Use a balanced header frame up to 640px wide: Back leads, Open menu trails, and the title centers independently. Journey screens add Deck beside Back, with a 12px gap and equal side reservations. Deck follows [menu inspection rules](../MENU_DESIGN.md#back-and-focus-return), previewing chosen starters during drafting.

Header and battle corner controls use 32px visible surfaces and 16px icons within 44px hit areas. Use 24px section gaps. Main menu keeps its Fauna title; battle has no main heading. Team confirmation omits Back.

## Main menu and Pause

Main menu places a gold default Continue/Play Button above a two-column grid of ghost Talents, Collection, Glossary and Settings Buttons. Conditional choices add rows; center a lone final choice. Buttons are 180px wide through 125% text, with 12px gaps. Center each icon/natural-width label group with an 8px gap. Show no promotional copy, decorative panels or reward previews.

Pause is a 240px-wide shadcn Popover, aligned below/right of Open menu with an 8px gap and viewport collision handling. Use ghost Buttons in one left-aligned icon/label list with 4px gaps. There is no title, close icon or dimmed backdrop. Continue, outside click or Escape/controller B dismisses it and returns focus.

Both menus show spendable talent points beside Talents with an accessible description; the count disappears when spent. End journey uses a red label and LogOut icon in Pause only. [Menu design](../MENU_DESIGN.md#menu-actions) owns action availability and order.

## Starter draft

Show three offers at shared artwork sizes, with content-width Recruit buttons beneath. Artwork opens inspection; Recruit commits the choice. Omit a Begin journey button: [starter rules](../EXPEDITION_DESIGN.md#roster-and-battles) own automatic start, saved choices, pools and Legendary eligibility.

All creature hover/focus tooltips show only the creature name as the header, the passive trait name with a sparkle icon, and the current passive rules. Trait names and icons share the short-label shine palette from keywords in the passive rules; rules retain solid keyword colors. Omit rarity labels, Block, status effects, kit labels and ability lists. Echo minions have no passive and show only their name.

## Creature and action inspection

Outside battle, use one centered shadcn Dialog panel over the shared dimmed backdrop, keeping the originating screen visible beneath it. Center the creature name above a row of three native portrait abilities with 12px gaps; omit the creature's base artwork. Show the current named trait, five progress stars and active passive description below. Stars fill left to right from zero to five; no rank controls or separate rank view appear. Ability names and rules are available through hover or intentional navigation focus. Keep accessible dialog titles.

[Inspection CSS](../../src/ui/inspection/inspection.css) fits the ability row to the panel width and remaining viewport height, capped by the 184px `--inspection-ability-max-width` per portrait. Keep the common center axis and [shared layout constraints](../UI.md#layout-artwork-size-and-spacing).

Activating a thumbnail pins its enlarged artwork in the same Dialog. A/D and controller left/right cycle the three actions without Previous/Next buttons. Card rules show final effects without a bonus breakdown or embedded Glossary definitions. Inspection has no Recruit/Choose action.

Creature/action inspection has no Back button. The accessible Close inspection X and outside click dismiss the whole overlay; Escape/controller B returns one level, restoring the selected ability or original opener. [Menu rules](../MENU_DESIGN.md#back-and-focus-return) own nesting and dismissal. Battle, piles opened in battle and required replacement use hover/focus details without nested pinned inspection. Enemy tooltips follow the shared creature tooltip contract and never reveal intents; full species kits belong in Collection.

## Collection

Use a centered title, All/Collected/Uncollected tabs, a gallery and pagination. Order collected species first. Collected artwork shows five external progress stars; name/details appear on hover/focus and activation opens the shared inspector. Uncollected artwork is grayscale and noninteractive, with no tooltip, kit details or unlock requirement. Browsing never grants discovery.

The inspector uses base species abilities without journey upgrades, talents or combat modifiers; permanent passive rank still applies. It has no separate ability/rank tabs. Collection remains available from battle Pause; returning preserves combat and leaves Auto-play off.

Reserve two gallery rows and a footer slot. Measured width chooses one to four columns independently of item count before reducing artwork. Previous/Next icon buttons have accessible names but no tooltips or page counts. Hide unavailable arrows while reserving their space; if a focused arrow disappears, focus the remaining arrow or the filter when neither remains.

Each filter remembers its first visible creature while mounted. Resize keeps that anchor on a visible page; shorter lists clamp the page. Inspection returns to the same filter, page and creature focus. Paging is instant.

## Talents

The overview shows every category in centered rows of at most five, with 12px column gaps. Portrait artwork grows to the largest size fitting row width and remaining height, without a fixed cap. Reserve full-size category names (16px) and available-point labels (13px), respecting text preferences and fixed caption line boxes. If no category has points, omit the empty point-label space.

Selecting artwork opens a dedicated tree. Show available points, exact XP and Progress above compact icon/name cards with visible effects and availability requirements. Authored rows contain two talents, with a possible single final talent. Measure remaining height to page up to three rows. The category-named header reset immediately refunds that category and is disabled without allocations. Purchases are immediate; definitions belong to the gameplay catalog.

Owned borders are gold. Icons use keyword color at 65% while unowned and full strength when owned, without checkmarks. Only available icons brighten 20% on hover, without growth. Ownership transitions over 150ms; purchase flashes the existing border gold then fades over 250ms. Focus takes priority over the flash; shared availability rules distinguish missing points from incomplete earlier rows.

## Victory, recruitment and team confirmation

### Earnings and choices

Show centered Victory earnings: keyword-colored icons/level labels with compact progress bars, then a separate Gold row. Continue opens Choose a Recruit without repeating earnings beside offers. An unchosen recruitment resumes through earnings; a banked full-roster recruit resumes directly at team confirmation.

[Reward rules](../EXPEDITION_DESIGN.md#recruitment) own the exact defeated-species offers and boss cadence. Recruitment has no Skip. Recruit buttons fit their label and standard padding, centered below artwork at the standard control height; artwork only inspects. This sizing also applies to starter recruitment. A first Collection unlock uses a small New! chip; otherwise show five stars, with earned ranks filled and the incoming star outlined with a plus. At maximum rank show five filled stars without a caption. Keep the group compact without unused pagination space. Boon choices retain their reserved choice area, external names and hover/focus effects; choose or Skip advances directly. An empty Boon pool advances automatically.

### Choose your team

For a full roster, center the incoming exchange artwork and opposing-arrow icon above one quiet Team tray of all five current individuals. Omit at-rest names, Health, pagination, Back and Cancel; hover/focus and inspection retain details.

Artwork activation previews one exchange using shared swap motion. Retargeting restores the previous individual; activating the selected member or upper artwork reverses the preview. One centered Confirm commits the displayed team, including keeping it unchanged. [Recruitment rules](../EXPEDITION_DESIGN.md#recruitment) own banking, preview isolation and reload behavior.

## Journey results

Show only outcome and permanent gains. Keywords use names, levels (earned points + 1) and progress bars without numeric XP gains/fractions or talent-point prompts. Omit teams, unlocks, statistics and temporary Boons. One centered Main menu action leaves results; there is no menu entry to reopen them. [Journey results](../EXPEDITION_DESIGN.md#screen-flow-and-journey-results) own banking and ending behavior.

## Encounter and required replacement

Show a quiet encounter number out of eight and keep compact last-battle earnings visible until the next battle begins. Ordinary combat uses one blank landscape ArtCard labeled Combat. Boss entrances show the authored name/species artwork and base-trait hover/focus details. Activating either starts the saved battle directly, without previews or visible intents. Keep Deck available. No free Swap or Lineup control appears.

When deployed knockouts have living backup, show a centered, nondismissible Choose a replacement Dialog. Put the knocked-out creature above living backup at shared sizes, separated by an up/down icon. Only backup choices commit, immediately. Focus the first living choice; successive knockouts receive successive prompts, then focus returns to the hand or End turn. Escape/outside click cannot bypass the choice. Backup stays hidden on the battlefield. [Replacement rules](../EXPEDITION_DESIGN.md#knockout-replacement-and-ability-swaps) own resume.

## Optional Recruit destination

Show creature artwork, Recruit and its species name. Its hover/focus details follow the shared creature tooltip contract. Activating the destination recruits directly, without a separate confirmation or roster-release step; unlike starter/reward offers, it is a direct-entry destination. [Journey rules](../EXPEDITION_DESIGN.md#recruitment) own eligibility and committed outcomes.

## Settings

Use a centered full screen up to 640px wide, native Display/Sound/Battle tabs and a stable header/tab row. Mounted inactive panels reserve the tallest category's natural height and remain invisible, inert and hidden from assistive technology. Do not add a fixed minimum or panel fade/movement. Use the shared secondary-scrolling recipe for long panels.

Use distinct Lucide icons, a 24px semibold light title, body-size pale-gold section headings with fading rules, 16px light option labels and muted supporting text. Align labels/controls in columns and values to control edges; wrap controls below labels when needed. Shared control styling belongs to [UI contracts](../UI.md#shared-control-states-and-feedback).

| Category             | Controls                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Display              | Independent Text size and Tooltip size radios: 75%, 100%, 125%, default 100%; Background Glow and Background Particles: 0–100%, default 100% |
| Sound                | Sound switch, Master/Music/Sound effects sliders with percentage readouts in 10-point steps (all default 50%), Mute in background            |
| Battle               | Auto-end turn switch, enabled by default; Controller prompts radios: Automatic (default), Xbox / Deck, PlayStation, Nintendo                 |
| Desktop Display only | Windowed/Fullscreen radios reflecting confirmed native state                                                                                 |

Controller prompts detect known browser device IDs; Steam Input may expose an Xbox identity for another controller, so manual selection takes precedence. Standard gamepad button positions remain unchanged. Losing the controller currently being used stops autoplay and opens pause during play; reconnecting does not resume.

Changes persist immediately outside progression and Cloud. Tooltip size changes tooltip type/width without scaling artwork. Sound changes apply live without replaying actions. Sliders retain native keyboard behavior; W/A/S/D and controller navigation adjust horizontally and move between rows vertically.

Cloud and diagnostics have no Settings surface, status or Retry control. [Recovery policy](../UI.md#recovery-and-persistent-failures) owns player consequences. Native fullscreen/overlay acceptance belongs to [Release](../RELEASE.md).

## Glossary

Use the shared secondary-scrolling recipe, keeping menus and Back outside the reading region and its final rule reachable. Definitions come from the [gameplay glossary](../GLOSSARY.md).

## Deck, piles and owned Boons

Deck and owned Boons use the existing modal owner and bounded pages. Draw/Discard Piles use shared portrait ArtCards beside the hand and open Deck-style viewers with accessible inspection names and empty states. Sort cards by definition/instance identity, never draw order; browsing follows the [read-only inspection contract](../MENU_DESIGN.md#back-and-focus-return). Battle viewers use hover/focus details without nested action inspection.

## Campfire

The Campfire destination uses location artwork with Rest beneath it. Inside the visit, page the whole roster on one measured row, showing current Health and exact capped recovery before a single Rest action. Use the [eligibility and recovery rules](../EXPEDITION_DESIGN.md#campfire).

Rest returns immediately to the same combat offers, briefly presenting committed before/after meters and actual recovery for healed creatures, including backup. Navigation and battle remain available; reduced motion shows final meters.

## Boon Merchant

Open directly from its existing landscape location ArtCard; source selection remains an explicit placeholder. Center up to three prepared portrait Boons with names/rules/journey duration in hover/focus details. Put the Gold wallet in the heading row, and “Limit 1 per customer - No Refunds!” centered in italics above the shelf. Align secondary purchase Buttons below artwork and center Leave. Wallet/prices use shared gold Coins icons.

Unaffordable purchases remain focusable, explain Not enough Gold and cannot issue commands. Buying replaces the shelf with one purchased Boon, name, rules, For this journey and Continue; move focus to Continue. [Support visits](../EXPEDITION_DESIGN.md#optional-support-visits) own purchase commitment, resume, prices, eligibility, leaving and rerolls.

## Startup loading

The HTML shell shows an uppercase filling gold Fauna wordmark, independent blowing leaves and rotating preparation phrases before importing React. Keep the same mounted splash through startup. It lasts at least five seconds from navigation start, then fades over 180ms after the ready app commits. Reduced motion keeps a gold wordmark, hides leaves, stops phrase rotation and removes fade while retaining minimum duration. Saved text size applies before first paint.

Startup validates bundled content once before loading the session. Invalid content never reaches save loading. A fatal preparation failure immediately keeps the same splash with a static gold wordmark and the accessible message Fauna could not start; hide leaves, stop phrase rotation and animation, and clear its busy state. The success-only minimum duration does not delay failure. Disposal prevents a late reveal or failure message; [recovery policy](../UI.md#recovery-and-persistent-failures) owns the boundary.

Fetch/decode menu/shared artwork and the saved journey's immediate screen in batches of four before reveal. Warm at most eight owned/offered ability images beyond that screen without gating play or inspecting hidden draw order; selection changes, backgrounding and disposal cancel obsolete preparation. Retain essential references until the ready screen commits, without keeping a whole-catalog decoded cache. Image/decode waits settle after 15 seconds, fonts after 10, recording failures internally. Presentation recovery retains the session and uses ordinary neutral loading without repeating startup. [Resource efficiency](../RESOURCE_EFFICIENCY.md#artwork-preparation) owns measurement and maintenance.
