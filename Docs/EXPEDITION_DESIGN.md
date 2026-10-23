# Journey progression — design decisions

This guide owns journey rules and progression. [Screen specifications](ui/screens.md) own presentation; [Menu design](MENU_DESIGN.md) owns navigation and [Keywords](KEYWORDS.md) owns combat packets/statuses.

## Roster and battles

- Your first journey begins with one creature, chosen from three seeded offers from the curated `FIRST_RUN_STARTERS` pool in `src/game/content.ts`. Team-oriented kits outside that solo pool remain recruitable and available in later collected drafts. The [first balance pass](archive/JOURNEY_BALANCE.md) records the opening-matchup evidence. The Recruit button commits that creature and immediately starts the journey, adding it to Collection. Inspecting and canceling do not collect it.
- Later journeys normally draft three starters from collected species: choose one of three offers, three times. Choosing a Legendary as the first pick instead completes the draft with that creature alone; later rounds offer only ordinary creatures. Each choice commits immediately and saves any next offer; the final required Recruit starts the journey automatically; no Begin journey control appears. Species may repeat across rounds. Eligible pools smaller than three repeat species within the offer, so an early loss never prevents a new journey. With three or more eligible species, each offer contains three distinct species.
- Clicking starter artwork opens read-only inspection; the content-width Recruit button beneath each offer commits it. Browsing, canceling and reloading preserve the current offers and earlier picks. Completing or resuming a completed draft starts the journey automatically.
- A journey roster grows to five creatures: up to three ordinary creatures deployed, or one Legendary with up to four backup. Multiple copies of a species are allowed. The drafted team supplies the remembered starting lineup. On the first journey, recruits fill its second and third slots before joining backup. The encounter screen offers one Combat or Boss placeholder ArtCard that starts battle directly. Deck remains available without requiring team selection.
- Formation changes only through knockout replacement, abilities and explicit game mechanics; there is no free Swap control or manual lineup editor. The changed formation persists into later battles.
- Only deployed living creatures act and provide passive traits. Enemy intents remain hidden.
- After the current action or turn resolves, a knocked-out deployed creature prompts a choice of living backup. Resolve knockouts in deployed order before another card or End turn; repeat while living backup remain. The choice is derived from saved roster state and resumes after reload.
- Replacements retain the outgoing owner's card slots in hand, overflow, draw and discard. Spent cards stay spent; replacements cost no Mana, grant no extra draws, and do not transfer card upgrades. Players cannot use replacement to rotate healthy or controlled creatures.
- Swap cards choose a random living backup, remove the departing kit from all zones, and shuffle the incoming kit into the draw pile before any draw effect. Without living backup they swap positions with a random living ally; alone the swap part does nothing. See [Captoad](content/creatures/captoad.md). [Tournelle](content/creatures/tournelle.md) instead swaps the lowest current-Health ally with a random living backup and draws one card; without backup it only draws.
- Creature identity, health, Block, and first-attack state stay with the creature. Normal turn expiration applies in backup; swapping never heals, cleanses, or repeats opening bonuses.
- If the deployed row falls, remaining enemy attacks stop and the next player turn begins with restored Mana. A required replacement choice brings in living backup. Defeat requires the whole roster to fall.
- Knocked-out card slots remain inert in saved battle zones and are skipped by ordinary draws. When the entire deployed row falls, the next hand reserves slots for incoming creatures so recovery does not require a free extra draw. These slots never render as playable cards for knocked-out owners.
- Victory preserves roster Health and knockouts. The next battle deploys the saved current formation; combat effects reset.
- Recruitment at five banks Collection progress before a team confirmation step. Players may replace one creature or keep the original roster; replacing a deployed creature updates the saved team directly.

## Encounters

- A journey has eight encounters: Combat, Combat, Combat, Boss, Combat, Combat, Combat, Boss. Only the final boss completes the journey.
- Each step has one saved encounter: Combat for the three ordinary battles, then Boss. Ordinary packs come from the shared combat pool; each Boss begins with one authored Legendary unless that species is on the roster, in which case it uses one eligible ordinary creature. Packs remain unchanged through menus, Campfire and reload; leaving a Boon Merchant prepares a new pack at the same combat encounter. Combat uses blank landscape artwork; Boss shows its authored name and species artwork, with names beneath. Campfire appears alongside the encounter whenever any roster creature, including a backup or knockout, is missing at least 30% of maximum Health. Rest restores 30% maximum Health to the whole roster, capped at full Health, and returns without advancing the encounter or changing RNG. The room type most recently visited is omitted from the returning destination options. Resting or leaving Campfire therefore suppresses Campfire until another room has been visited. Combat or Boss remains available as the required progression fallback.
- Combat and Boss entrances use 4:3 ArtCards, with Combat or the boss name below the artwork. Campfire uses Rest beneath its location art; entering it commits a saved visit and exposes Rest as its only option. A quiet heading shows the encounter number out of eight.
- Activating Combat or Boss immediately commits the saved encounter and starts battle. There is no enemy preview, inspection dialog or separate Begin battle action. Creature and action hover/focus details remain available during battle; pinned kit inspection belongs outside battle and in Collection.
- Enemy generation excludes every species on the player’s roster, including backups and knocked-out creatures. Replace matching slots with seeded ordinary species while preserving the encounter’s enemy count. Recruiting at an optional destination replaces only newly conflicting enemy slots; later recruitment never rewrites completed battle rewards.
- Seeded gameplay chooses and saves the exact species in one enemy pack when entering the encounter screen. Menus, Campfire and reload never reroll enemies or consume randomness; completing a Boon Merchant room prepares fresh destinations.
- The shared enemy pool varies between runs. Every enemy, including Legendaries, starts from its species’ authored base Health before encounter scaling; recruits use the unscaled species Health. Health and authored ability damage, healing and Block gain an additive 10% of their base per room after the first: 100% in room 1 through 170% in room 8, rounded to the nearest whole number. Support visits do not advance this scaling. Enemies use shared authored ability values, including area attacks, modified by explicit room power rather than replacement encounter damage. Chances, effect counts, resources and passive tiers do not scale; mixed Block-or-Thorns effects scale only Block. Supplemental ability damage/healing scales once through the same room power. The first battle has one enemy and the second has two. These values are playtest tuning, not final balance.

## Keyword XP and talents

- Progression uses permanent keyword XP and talents rather than individual creature training.
- Keyword progression is shared across the collection. Talents benefit any creature using the relevant keyword, rather than belonging to individual species.
- Each accepted card play earns 1 XP for each eligible keyword on that card, regardless of effect magnitude. A Burn + Block card earns 1 Burn XP and 1 Block XP.
- Earned keyword XP becomes permanent after each battle, including defeat.
- Talents are accessible through the main menu at any time. Purchases take effect immediately, including during a journey.
- Do not interrupt journeys or prompt players to spend talent points.
- Talents mix straightforward stat bonuses with new interactions and combo effects. The applicable Alchemy effects are implemented in the authored catalog.
- Every talent can eventually be unlocked; there is no limited active-talent loadout.
- Each category starts with the existing two talents. Later talents form rows of two, with a possible single-talent final row; complete all earlier rows to open the next.
- The Talents screen opens on a keyword artwork overview, following Alchemy. Selecting a keyword opens its dedicated tree; Back returns to the overview.
- Each talent shows its icon, name, and full effect directly on the talent. Effects use concise rules with ownership implied where clear. All talents have distinct effects; do not repeat a shared talent set across keywords.
- Clicking an available talent purchases it immediately, without a detail-dialog purchase step or confirmation.
- Reset operates on the entire keyword category, refunding all spent points in that category while retaining its XP. Reset is available at any time, including during a journey; talent effects update immediately. Individual-talent refunds are not the chosen interaction.
- Use Alchemy’s current point pacing: cumulative thresholds are 10, 40, 100, 180, and 280 keyword XP. Total XP for point n is 10 × n × (n + 1) − 10 × min(n, 2). This is initial tuning for playtesting.
- Fifteen consolidated categories offer 135 distinct talents, adapted from Alchemy; effects requiring excluded mechanics are omitted. Burn, Freeze, Stun and Health use their matching progression; Thorns belongs to Nature, Cleanse to Health, and Purge to Light. Forge is removed. The authored trees live in `src/game/content/talents/`, aggregated by `src/game/content/talents.ts`; progression calculations belong to `src/game/progression.ts` and combat execution to `src/game/combat/`.
- Abandonment banks the XP earned by accepted plays, with no victory currency or boons. Auto-play dispatches ordinary accepted plays; each awards keyword XP once. Talent repeats resolve at most once and award no extra accepted-play XP.

## Recruitment

- Optional Recruit destinations offer one uniformly selected creature from the ordinary species catalog, including uncollected and already-owned species. Legendaries are excluded from optional Recruit destinations. They roll only while the roster has fewer than five creatures and stop appearing at five.
- Activating optional Recruit recruits directly at full Health, filling an ordinary lineup up to three and then backup; a deployed Legendary keeps recruits in backup. There is no confirmation/release step. Recruitment counts toward permanent Collection and passive ranks. [Optional Recruit presentation](ui/screens.md#optional-recruit-destination) owns artwork, labels and full-kit hover/focus disclosure.
- Claiming consumes the saved offer atomically without advancing the encounter, spending Gold or changing RNG. Starting the battle skips any unclaimed offer. Optional recruitment does not change ordinary victory recruitment.

- Recruit from defeated enemy species after an ordinary combat victory.
- Recruiting adds a creature to the journey roster rather than forcing an immediate active-team replacement.
- The first battle contains one enemy, the second contains two, and every later ordinary battle contains three; Boss encounters begin with one Legendary. Choose a Recruit shows the exact defeated enemy entries in battle order, including repeated species and species already in the roster. Recruiting creates a new individual with independent identity and battle state.
- With an open roster, Recruit adds the creature immediately. At a full roster, it commits Collection progress before the separate team confirmation described below.
- Recruit one defeated creature; recruitment commits Collection progress immediately and cannot be canceled. Collected species persist after release, defeat and return home. Encountering a species or unlocking it through victory does not collect it.
- At a full roster, the committed recruit opens Choose your team. The original five-creature team is selected initially. Artwork exchanges preview one replacement at a time using the shared battle arc motion; choosing another target restores the previous individual, and activating the selected creature or the upper exchange artwork reverses the preview. Confirm accepts the displayed team, including keeping the original team without a swap. Only Confirm changes the roster; previews never save or grant progress. Reload resumes the banked recruit with the original team preview and never grants Collection progress twice.

## Currency and items

- All Gold is permanent and carries between journeys.
- Gold buys journey Boons at Boon Merchants; permanent upgrade purchases and other currencies are undefined.
- [Optional support visits](#optional-support-visits) own Recruit/Merchant rolls, prices and saved offers. Spending atomically reduces the wallet; journey earnings measure gross retained income.
- When a battle awards a Boon, offer up to three distinct unowned choices.
- Choose one Boon or skip its reward. Owned Boons remain inspectable from the menu during a journey; [screen specifications](ui/screens.md#victory-recruitment-and-team-confirmation) own artwork and disclosure.
- Starter tuning: Currency pays 20 per ordinary victory and 40 for each boss. Intermediate bosses offer up to three distinct unowned Boons; smaller nonempty pools remain available. Ordinary combat offers recruitment, never boons; intermediate bosses offer Legendary recruitment followed by Boons; the final Boss offers recruitment before journey completion. Eighteen Boons are authored in `src/game/content/boons.ts`; their ownership lasts only for the journey. Material types and permanent upgrade purchases remain undefined.

## Screen flow and Journey results

Journey is the player-facing name. Internal command IDs, route fields, filenames, and storage paths retain their existing names.

Ordinary victory → Victory earnings step → Continue → recruitment → the next encounter. Intermediate boss victory → Victory earnings step → Continue → Legendary recruitment → boon choices (if available) → the next encounter. The earnings step shows keyword progress and a separate Gold row; choice steps omit earnings. Compact last-battle earnings remain visible on the encounter screen until the next battle. If neither decision is available, proceed directly to the next encounter.

Final Boss victory → required recruitment → Journey results. Defeat → Journey results. Ending a started journey voluntarily also opens results, labeled Returned home. Ending an unfinished starter choice simply returns to the main menu.

- Results show only the outcome, keyword XP and permanent currencies/resources/items earned. Do not show the team, creature unlocks, journey-only boons, location, or journey statistics. Currency is the only authored permanent resource currently; do not invent item or material rewards.
- Keyword totals include all settled battles and XP banked when returning home. Follow Alchemy’s results presentation: keyword name, level (earned points + 1), and progress bar only. Hide numeric XP gains/fractions and points-earned lines here; the Talents screen owns point availability. Talents remain menu-driven; never prompt purchases here.
- Banking and totals update atomically with accepted gameplay commands. Browsing results never grants rewards or saves. Report actual retained earnings at progression caps.
- Results offer a single centered Main menu action. Start a new journey only from the main menu.
- Play resets journey totals and roster/boons while preserving permanent progress. Results appear only when ending the journey; returning to the main menu or loading a completed journey does not reopen them.
- Development saves are disposable; obsolete formats are rejected rather than migrated. Journey totals are recorded from current-format journeys, never inferred from lifetime XP or currency.
- Material types remain undefined and are not shown. Victory Continue is presentation-only: it leaves committed earnings/offers unchanged. Recruitment is required; only Boon choices retain Skip. [Recruitment](#recruitment) owns full-roster confirmation.

See [UI design system](UI.md) for composition and interaction rules.

## Turn and combat foundation

Leaving results returns directly home. All species are available to encounter and recruit; Collection and later starter eligibility depend on actual recruitment. Reopening results grants no additional progress.

## Combat assistance

Auto-end turn is enabled by default and advances only when Mana reaches zero. Its Settings switch persists separately from progression; disabling it leaves End turn under player control. Victory and defeat settle immediately in either mode.

Auto-play is explicitly enabled for one battle. It uses visible information to choose legal recovery swaps, healing, finishing attacks, other attacks and useful defenses, then ends turns when no useful play remains. Actions occur no faster than every 700 ms. Menus, inspection, focus loss and hidden pages pause it; manual play stops it. Rewards, encounters, recruitment and talents always remain player choices. It stops on completion, home navigation and shutdown; save retries remain independent of combat assistance.

### Catalog availability

Leaving results returns directly home. All species are available to encounter and recruit; Collection and later starter eligibility depend on actual recruitment. Reopening results grants no additional progress.

Development builds add a Skip combat icon beside the battle menu and Auto-play controls. It settles a normal victory with normal rewards and only XP already earned by actual plays; roster Health is preserved. It is unavailable in production and rejects repeated settlement.

## Optional support visits

Boon Merchant rolls independently alongside Recruit at the shared 25% rate when preparing destinations, only when at least one unowned Boon is affordable and the last room was not a Merchant. It does not replace or advance a battle. Activating the Boon Merchant ArtCard commits the saved visit directly and rechecks affordability. Leaving, including Back, completes that room even without buying: prepare a fresh combat pack and optional Recruit destination, suppress the Boon Merchant, and retain the current battle ordinal and all eight battles. Beginning a battle instead forfeits the unvisited Merchant.

The Boon Merchant offers up to three distinct unowned Boons at independently rolled integer prices of 20–40 Gold each, inclusive (13–33 with Merchant’s Favor when stock is prepared). Prices are committed with the offers and never reroll through inspection, menus, Campfire or reload. Purchase commits one Boon and opens its saved reward screen; [Merchant presentation](ui/screens.md#boon-merchant) owns layout and disclosure. The purchase is already granted; Continue or Back completes the room without granting it again. Both the shelf and purchased reward survive menus and reload without rerolling, duplicate grants or repeated spending. Gold carries between journeys; bought Boons last only for that journey. Omit the Merchant with no eligible stock or insufficient Gold. Campfire visits preserve a pending Merchant offer. Merchant and Campfire grant no keyword XP or recruitment; Recruit grants only its offered creature.

## Legendaries and Minions

Memento’s Pearls have Consume: played Pearls leave the battle after their effects and court trigger, while unplayed Pearls discard and recycle normally. The Court Remembers deals 3–8 Water damage across its six passive tiers, once per accepted card with no attacks-per-turn limit. Treasury Echo still creates two Pearls; Drowned Revelation only draws two cards.

Legendaries appear as enemies only in Boss encounters and remain ordinary recruitable roster individuals. The five-creature roster accepts any combination of Legendaries and ordinary creatures. A Legendary starter fills the starting lineup alone. Deploying one returns every deployed creature to backup; replacing it with an ordinary creature leaves two vacant positions; later recruits may fill them under the ordinary recruitment rules. No manual formation editing is available.

Each deployed Legendary supplies two copies of each of its three abilities. Formation changes preserve existing spent zone positions, remove surplus slots, and shuffle additional slots into Draw without granting cards to hand. Generated cards disappear when their owner leaves the field.

Minions belong only to the active battle, have Health and combat effects, and can be attacked or affected by group abilities. They have no roster slots, backup, cards, autonomous turns or Death's Door. They disappear when their summoner falls or leaves the field. Defeating an enemy Legendary wins even if its Minions remain.

Enemy Legendaries use six cards, four Mana and four draws per turn, with the six-card hand and persistent overflow used by the player. They create and cycle Pearl cards through their own zones. Automatic enemy decisions are bounded to 256 plays per turn.

[Memento](content/creatures/memento.md) owns the first Legendary kit and initial tuning.
