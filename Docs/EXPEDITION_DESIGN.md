# Journey rules

This guide owns journey rules and progression. [Screen specifications](ui/screens.md) own presentation; [Menu design](ui/screens.md#navigation-and-menus) owns navigation and [Keywords](KEYWORDS.md) owns combat packets/statuses.

## Roster and battles

### Starter draft

The first journey starts with one creature chosen from three seeded offers in `FIRST_RUN_STARTERS` in `src/game/content.ts`. Recruit commits the choice, adds it to Collection and starts the journey. Team-oriented kits outside this solo pool remain available through encounters, recruitment and later drafts. The [first balance pass](archive/JOURNEY_BALANCE.md) records the opening-matchup evidence.

Later journeys draft up to three distinct collected ordinary species. Each round offers up to three species not already chosen. When fewer than three ordinary species are collected, draft only that many; offers never repeat a species to fill space. A Legendary first pick completes the draft alone; later rounds offer only ordinary creatures. An early loss cannot prevent another journey.

Each choice commits immediately and saves the next offer. Browsing, inspection, cancellation and reload preserve offers and earlier picks. The final required Recruit starts the journey automatically, including when resuming a completed draft. [Starter presentation](ui/screens.md#starter-draft) separates inspection from recruitment.

### Formation

A roster holds up to five individuals, with at most one of each species across deployed creatures and backup. Repeat recruitment improves permanent Collection rank without adding, replacing, reviving or refreshing the existing individual, including at a full roster. Deploy up to three ordinary creatures or one Legendary with up to four backup. The draft supplies the remembered starting lineup; on the first journey, recruits fill slots two and three before joining backup.

Living deployed creatures act and provide passives; explicit swap mechanics also retain departing providers for the exchange. Formation changes through knockout replacement, abilities and explicit mechanics; there is no free Swap or lineup editor. The resulting formation persists between battles. Health, Block, first-attack state and effects belong to each individual; normal turn expiration applies in backup. Formation changes alone do not heal, cleanse or repeat opening bonuses; explicit swap abilities and passives such as [Gentle Passage](content/creatures/dulcera.md#gentle-passage) can grant recovery. Victory preserves Health and knockouts while combat effects reset for the next battle.

### Knockout replacement and ability swaps

| Change                             | Card zones and resources                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required knockout replacement      | Retain the outgoing owner's slots in Hand, overflow, Draw and Discard; spent cards stay spent; no Mana, extra draws or transferred card upgrades    |
| Ordinary swap ability              | Select random living backup with seeded RNG; remove the departing kit from every zone and shuffle the incoming kit into Draw before any draw effect |
| Swap ability without living backup | Swap positions with a random living ally; alone, the swap portion does nothing                                                                      |

After an action or turn resolves, replace knocked-out deployed creatures in deployment order while living backup remain, before another card or End turn. Choose among multiple living backups; the application immediately dispatches the same replacement command when only one living backup remains. Reload reconstructs any pending replacement from saved roster state. Replacement cannot rotate healthy or controlled creatures.

If the deployed row falls, stop remaining enemy attacks and begin the next player turn with restored Mana and required replacements. Defeat requires the whole roster to fall. Knocked-out owners retain their card slots in saved zones; ordinary draws skip them unless a living deployed [Oathara](content/creatures/oathara.md#identity-and-ownership) supplies Unfinished Journey. That passive keeps fallen allies' cards drawable and permits a bounded number of borrowed plays without changing ownership. Required replacement still takes priority over card play. The next hand reserves incoming slots after a whole-row knockout, avoiding a free extra draw.

[Captoad](content/creatures/captoad.md) illustrates ordinary swap abilities. [Tournelle](content/creatures/tournelle.md) instead swaps the lowest current-Health ally with random living backup and draws one; without backup it only draws. [Legendary formation changes](#legendaries-and-minions) adjust kit sizes separately. [Recruitment](#recruitment) defines full-roster replacement and deployed replacements.

## Encounters

A journey has eight battles, with Bosses fourth and eighth. Only the final Boss completes it. Ordinary enemy counts are one in battle 1, two in battle 2 and three thereafter. Bosses begin with one authored Legendary; if its species is on the roster, use one eligible ordinary creature instead.

### Saved enemy packs

Prepare and save the exact enemy pack with seeded RNG on entering the encounter screen. Ordinary packs use the shared combat pool. Exclude every roster species, including backup and knockouts; replace conflicting slots with seeded ordinary species while retaining pack size. Optional recruitment replaces only newly conflicting slots and never rewrites completed rewards.

Menus, Campfire and reload preserve packs and consume no pack RNG. Completing a Merchant room prepares a fresh pack at the same battle ordinal. Combat or Boss always remains available as the progression fallback.

Activating the encounter commits its pack and starts battle directly, without an enemy preview, inspection dialog, Begin battle step or team selection. Deck remains available. Enemy intents stay hidden; pinned kit inspection belongs outside battle and in Collection. [Encounter presentation](ui/screens.md#encounter-and-required-replacement) owns artwork, labels and readouts.

### Enemy scaling

Enemies, including Legendaries, start from authored species Health; recruits use unscaled Health. Health and authored damage, healing and Block gain 10% of their base per room after the first: 100% in room 1 through 170% in room 8, rounded to the nearest whole number. Support visits do not advance scaling.

Shared ability values, including area attacks and supplemental damage/healing, scale once through explicit room power. Chances, effect counts, resources and passive tiers do not scale; mixed Block-or-Thorns effects scale only Block. Enemy pools vary between runs. These values are playtest tuning, not final balance.

### Enemy decisions

Selectable attacks target the living player creature with the highest current Health, including Minions; ties retain battlefield order. Authored random and area attacks keep their targeting rules, and interception can redirect an attack.

Ordinary enemies choose their highest-value usable ability; Legendary enemies rank their current hand again after each play. Value estimates immediate net combat gains: each point of actual Health restored, damage dealt, Block, status stacks or deck resources is worth one; protection flags are worth one. Overhealing and redundant effects add nothing, caps and mitigation apply, and retaliation reduces value. Ally-targeted support chooses the recipient with the greatest benefit. Equal values retain authored/hand order, preferring a different ordinary ability over the previous turn's ability; enemies skip plays with no positive benefit.

The estimate runs the shared ability resolver on isolated drafts. Eight fixed probes approximate chance outcomes without consulting or advancing live RNG; this is an immediate-effect heuristic rather than a future-turn search. Card costs are paid before estimating resource restoration, while ranking uses the gross effect value. Legendary card-triggered Echo attacks contribute to value and retain their random targeting.

## Keyword XP and talents

Keyword XP and talents are permanent and shared across species. Each accepted card play earns 1 XP per distinct eligible keyword regardless of magnitude: Burn + Block earns one of each. An ability can resolve at most twice per play; repeats grant no extra accepted-play XP. Auto-play uses ordinary accepted commands.

Battle settlement banks XP even on defeat. Returning home banks pending accepted-play XP without victory currency or Boons. Talents remain menu-driven; never interrupt a journey or prompt spending.

| Operation     | Rule                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purchase      | Immediate through the menu, including during a journey; every talent is eventually obtainable, without an active loadout or purchase confirmation |
| Prerequisites | Follow [keyword categories and rows](KEYWORDS.md#classification-and-progression); each talent has a distinct effect                               |
| Reset         | Refund the whole category while retaining XP; available at any time and effects update immediately; no individual refunds                         |
| Point pacing  | Cumulative thresholds 10, 40, 100, 180 and 280 XP; point n requires total XP `10 × n × (n + 1) − 10 × min(n, 2)`                                  |

Point pacing is initial tuning adapted from Alchemy. [progression.ts](../src/game/progression.ts) owns calculations; the [talent catalog](../src/game/content/talents.ts) owns stat bonuses and interactions. [Talent presentation](ui/screens.md#talents) owns browsing, visible rules and availability.

## Collection and passive ranks

Actual recruitment permanently collects a species. Its first copy gives zero stars; the sixth reaches five stars. Counts persist across journeys and cap at six; collection survives release, defeat and return home. Committing the first onboarding starter grants one initial copy; later starter drafts and encounter discovery grant none. All species are available to encounter and recruit; later starter eligibility requires collection. [Content](CONTENT.md#creature-passive-tiers) owns tier authoring; player creatures use permanent rank and enemies use the base tier.

## Recruitment

### Optional Recruit destinations

Offer one uniformly selected ordinary species, including uncollected and already-owned species, only while the roster has fewer than five individuals. Legendaries are excluded. [Support visits](#optional-support-visits) defines destination rolls.

Activating Recruit consumes the saved offer and adds a new species at full Health directly, without confirmation or release. Recruiting a species already on the roster only improves Collection rank and preserves the existing individual. Fill ordinary deployment up to three, then backup; a deployed Legendary keeps recruits in backup. The command grants Collection progress without advancing the battle, spending Gold or consuming RNG. Starting battle forfeits the unclaimed offer. This is independent of victory recruitment. [Optional Recruit presentation](ui/screens.md#optional-recruit-destination) owns full-kit disclosure.

### Victory recruitment

Victories require recruiting one defeated creature, following the [outcome flow](#screen-flow-and-journey-results). Offers preserve defeated entries in battle order, including repeated species and species already owned. A species absent from the roster joins as a new individual with independent identity and battle state; an already rostered species improves Collection rank without adding another individual.

With roster space, add a new species immediately. A repeat species completes recruitment immediately, even at five creatures, preserving the original roster. For a new species at five creatures, bank Collection progress and show the current team and incoming creature. Activating a team member immediately replaces it; Keep team preserves the original roster. Replacing a deployed member updates the saved formation. Hover and inspection never save, consume RNG or grant progress. Reload restores the pending choice around the saved recruit without collecting twice. Recruitment cannot be canceled after committing it. [Replacement choice](ui/screens.md#replace-a-creature) owns its presentation.

## Currency and items

Gold is permanent and buys journey Boons at Merchants. Ordinary victories grant 20 and Boss victories 40 as initial tuning. Spending atomically reduces the wallet; journey earnings measure gross retained income. Permanent upgrade purchases, other currencies and material/item rewards are undefined.

Intermediate Bosses offer up to three distinct unowned Boons after recruitment. Offers are prepared at victory using the current roster, including backup; Boons sharing a keyword with a creature’s current passive or abilities have twice the selection weight, while all unowned Boons remain possible. Choose one or Skip; smaller nonempty pools remain available and empty pools advance automatically. Ordinary victories offer recruitment only; the final Boss offers recruitment before results. Boons last for the journey and remain inspectable through its menu.

The [Boon catalog](../src/game/content/boons.ts) defines available items. [Support visits](#optional-support-visits) defines stock, rolls and saved prices; [reward presentation](ui/screens.md#victory-recruitment-and-team-replacement) defines disclosure.

## Screen flow and Journey results

Journey is the player-facing name; internal command IDs, routes, filenames and storage paths retain their existing names.

| Outcome                   | Flow after settlement                                                           |
| ------------------------- | ------------------------------------------------------------------------------- |
| Ordinary victory          | Earnings and required recruitment → next encounter                              |
| Intermediate Boss victory | Earnings and required recruitment → Boon choice when available → next encounter |
| Final Boss victory        | Required recruitment → Journey results                                          |
| Defeat                    | Journey results                                                                 |
| End a started journey     | Bank pending XP → Journey results, labeled Returned home                        |
| End an unfinished draft   | Main menu                                                                       |

Earnings appear alongside the required Recruit choice without an extra Continue. Recruitment is required; only Boon choices retain Skip. Missing optional choices advance automatically. [Recruitment](#recruitment) owns full-roster replacement.

Settlement and voluntary return bank actual retained earnings atomically, respecting progression caps. Browsing earnings/results never grants rewards or saves. Journey totals include all settled battles and XP banked on return home; they are never inferred from lifetime XP or currency. No material or item rewards are authored.

Starting a new journey resets its totals, roster and Boons while preserving permanent progress. Results appear only when ending a journey; returning home or loading a completed journey does not reopen them. [Results presentation](ui/screens.md#journey-results) owns visible gains and controls; [Menu design](ui/screens.md#navigation-and-menus) owns navigation.

## Turn and combat foundation

Each turn normally restores four shared Mana and draws four cards, with explicit talent and Boon modifiers. The hand normally holds six cards, or seven with Facet Abacus; FIFO overflow persists across turns. End turn promotes waiting cards before normal draws, and accepted plays fill open slots from overflow without RNG. Draw/Discard inspection never reveals draw order or changes gameplay.

[Keywords](KEYWORDS.md) defines packets, defenses, statuses and crowd control, including halving Block and the absence of elemental reactions. Effects tick and expire in backup; swaps cannot refresh them. Ordinary enemies rank supported species abilities; Legendaries rank their current hand under the same [decision rules](#enemy-decisions). Neither reveals the next ability.

## Combat assistance

Auto-end turn is enabled by default and advances at zero Mana once no legal free plays remain. Its Settings switch persists separately from progression; disabling it leaves End turn under player control. Victory and defeat settle immediately in either mode.

Auto-play is explicitly enabled for one battle. It uses visible information to choose legal recovery swaps, healing, finishing attacks, other attacks and useful defenses, then ends turns when no useful play remains. Actions occur no faster than every 700 ms. Menus, inspection, focus loss and hidden pages pause it; manual play stops it. Rewards, encounters, recruitment and talents always remain player choices. It stops on completion, home navigation and shutdown; save retries remain independent of combat assistance.

Development builds expose Skip combat beside the battle menu and Auto-play. It settles ordinary victory rewards with only XP earned by actual plays, preserves roster Health and rejects repeated settlement. Production cannot use it.

## Optional support visits

Recruit and Boon Merchant roll independently at 25% when preparing destinations, subject to their eligibility rules. Support visits never advance the battle ordinal or remove any of the eight battles. Omit the most recently visited room type from returning options; Combat or Boss remains available.

### Campfire

Offer Campfire when any roster member, including backup or knockout, is missing at least 30% maximum Health, unless Campfire was the last visited room. Entering commits a saved visit; Rest is its only recovery action. Rest restores 30% maximum Health to the whole roster, capped at full, without advancing the battle or consuming RNG.

Resting or leaving suppresses Campfire until another room is visited. Both preserve the enemy pack; Campfire also preserves pending Merchant offers. [Campfire presentation](ui/screens.md#campfire) owns recovery readouts.

### Boon Merchant

Offer Merchant only when it was not the last room and at least one unowned Boon is affordable. Entering commits the saved visit and rechecks affordability. Starting battle forfeits an unvisited Merchant.

Stock uses the same roster keyword weighting as Boss rewards and contains up to three distinct unowned Boons, each with an independently rolled integer price of 20–40 Gold inclusive. Merchant's Favor subtracts 7 when stock is prepared, yielding 13–33. Inspection, menus, Campfire and reload preserve prices.

Purchase commits one Boon and immediately completes the room. A saved purchase resumes by completing the room without another grant. Shelf and purchase survive menus/reload without duplicate grants or spending. Leaving, including Back without buying, prepares a fresh combat pack and optional Recruit offer at the same ordinal and suppresses Merchant. Gold remains permanent; the bought Boon lasts for the journey. Merchant and Campfire grant no XP or recruits; Recruit grants only its offered creature. [Merchant presentation](ui/screens.md#boon-merchant) owns layout and disclosure.

## Legendaries and Minions

Legendaries appear as enemies only in Boss encounters and remain ordinary recruitable roster individuals. The five-creature roster accepts any combination of Legendaries and ordinary creatures. A Legendary starter fills the starting lineup alone. Deploying one returns every deployed creature to backup; replacing it with an ordinary creature leaves two vacant positions; later recruits may fill them under the ordinary recruitment rules. No manual formation editing is available.

Each deployed Legendary supplies two copies of each of its three abilities. Formation changes preserve existing spent zone positions, remove surplus slots, and shuffle additional slots into Draw without granting cards to hand. Creature-owned generated cards disappear when their owner leaves the field. Shared [Food](CONTENT.md#shared-food-cards) has no creature owner and survives creator departure; adding a permanent kit at the 256-card battle limit may retire the newest temporary cards to make room.

Minions belong only to the active battle, have Health and combat effects, and can be attacked or affected by group abilities. They have no roster slots, backup, cards, autonomous turns or Death's Door. They disappear when their summoner falls or leaves the field, including between recipients of an area attack or successive bounces; departed Minions cannot spend defenses or retaliate. Defeating an enemy Legendary wins even if its Minions remain.

Enemy Legendaries use six cards, four Mana and four draws per turn, with the six-card hand and persistent overflow used by the player. Automatic enemy decisions are bounded to 256 plays per turn.

[Memento](content/creatures/memento.md) defines the Legendary kit, Echoes, Pearl generation/Consume and initial tuning. Memento currently fills both Boss encounters, with the ordinary-creature fallback when already on the roster.
