import { forEachPermanentCard } from "./card-kit";
import { battlefield, isRosterCreature } from "./battlefield";
import { drawOwner, recycleDiscard, fillHand, filterCardZones, MAX_BATTLE_CARDS } from "./card-zones";
import { removeDepartedMinions } from "./combat/legendary";
import { grantArmor, grantBlock, restoreHealth, removeEffects, hit, ensureCombat } from "./combat/index";
import { boonRule } from "./rules/boons";
import { unitName, type Combatant } from "./combat/state";
import { passiveAmount } from "./progression";
import { shuffle, roll } from "./random";
import { speciesCards, species } from "./content";
import type { Card, GameEvent, GameState } from "./types";

/** Both sides of the exchange provide passage, including Dulcera's own departure or arrival. */
export function gentlePassage(state: GameState, previous: GameState["team"], events: GameEvent[]) {
  if (state.phase !== "battle") return;
  const entering = state.team.filter((unit) => !previous.some((old) => old.id === unit.id));
  if (!entering.length) return;
  const providers = new Map<string, (typeof state.team)[number]>();
  for (const unit of previous) providers.set(unit.id, unit);
  for (const unit of state.team) providers.set(unit.id, unit);
  for (const provider of providers.values()) {
    if (provider.health <= 0) continue;
    const amount = passiveAmount(state, provider.species, "gentlePassage");
    if (amount <= 0) continue;
    for (const unit of entering)
      restoreHealth(unit, amount, events, false, state, false, provider, { bounce: false });
  }
}

export function living(state: GameState) {
  return state.team.filter((c) => c.health > 0);
}
const controlStatuses = ["stun", "freeze"] as const;
export function cleanseDeparture(state: GameState, outgoing: Combatant, events: GameEvent[]) {
  if (state.phase !== "battle" || outgoing.health <= 0 || !state.boons.includes("prayer-sailboat")) return;
  for (const status of controlStatuses)
    if (
      outgoing.health > 0 &&
      (outgoing.combat?.controlled === status || (outgoing.combat?.[status] ?? 0) > 0)
    )
      removeEffects(outgoing, "cleanse", 1, events, state, status);
}
export function rookOfMercy(state: GameState, incoming: readonly Combatant[], events: GameEvent[]) {
  if (!state.boons.includes("rook-of-mercy")) return;
  for (const ally of incoming)
    if (ally.health > 0) grantArmor(state, ally, boonRule("rook-of-mercy").armor, events);
}
export function farewellOar(state: GameState, outgoing: readonly Combatant[], events: GameEvent[]) {
  if (state.phase !== "battle" || !state.boons.includes("farewell-oar")) return;
  for (const ally of outgoing) {
    const damage = Math.round(ally.block / boonRule("farewell-oar").divisor);
    if (ally.health <= 0 || damage <= 0) continue;
    for (const enemy of battlefield(state, "enemy"))
      if (ally.health > 0 && enemy.health > 0)
        hit(state, ally, enemy, damage, "water", events, { origin: "derived" });
  }
}
/** Match existing protection without spending it or amplifying fresh Block grants. */
export function matchSwapBlock(state: GameState, first: Combatant, second: Combatant, events: GameEvent[]) {
  if (
    state.phase !== "battle" ||
    first.health <= 0 ||
    second.health <= 0 ||
    !state.boons.includes("tide-anklet")
  )
    return;
  const higher = Math.max(first.block, second.block);
  for (const unit of [first, second]) {
    const gained = higher - unit.block;
    if (gained <= 0) continue;
    unit.block = higher;
    events.push({
      kind: "block",
      targetId: unit.id,
      amount: gained,
      text: `${unitName(unit)} keeps ${higher} Block with Tide Anklet`,
    });
  }
}
export function shareSwapNullify(state: GameState, first: Combatant, second: Combatant, events: GameEvent[]) {
  if (
    state.phase !== "battle" ||
    first.health <= 0 ||
    second.health <= 0 ||
    !state.boons.includes("welcome-doormat")
  )
    return;
  const a = ensureCombat(first),
    b = ensureCombat(second);
  if (!a.nullify && !b.nullify) return;
  for (const [unit, stats] of [
    [first, a],
    [second, b],
  ] as const) {
    if (stats.nullify) continue;
    stats.nullify = true;
    events.push({
      kind: "status",
      status: "nullify",
      outcome: "apply",
      targetId: unit.id,
      text: `${unitName(unit)} gains Nullify`,
    });
  }
}
export function rosterHasSpecies(
  state: Pick<GameState, "team" | "reserves">,
  kind: import("./content").SpeciesId,
) {
  return (
    state.team.some((unit) => unit.species === kind) || state.reserves.some((unit) => unit.species === kind)
  );
}
export function ownedCards(id: string, kind: GameState["team"][number]["species"]): Card[] {
  const cards: Card[] = [];
  forEachPermanentCard(kind, (definition, copy) =>
    cards.push({
      id: `${id}:${definition.id}${copy ? ":2" : ""}`,
      definitionId: definition.id,
      ownerId: id,
      level: 0,
    }),
  );
  return cards;
}
/** Recruitment and its policy projection use the same legal deployment rules. */
export function recruitLineup(
  state: GameState,
  incoming: Pick<import("./types").Creature, "id" | "species">,
  replacement?: string,
): string[] {
  const active = state.team.map((unit) => unit.id);
  if (replacement) {
    const ids = active.map((id) => (id === replacement ? incoming.id : id));
    return ids.includes(incoming.id) && species(incoming.species).legendary ? [incoming.id] : ids;
  }
  return active.length < 3 &&
    !species(incoming.species).legendary &&
    !state.team.some((unit) => species(unit.species).legendary)
    ? [...active, incoming.id]
    : active;
}
/** Joining a roster changes individuals and deployment; Collection progress is granted separately. */
export function addRecruit(state: GameState, kind: import("./content").SpeciesId, replacement?: string) {
  // Repeat discoveries improve Collection rank without replacing or refreshing an individual.
  if (rosterHasSpecies(state, kind)) return;
  let id = `recruit-${state.revision}`;
  for (
    let suffix = 1;
    state.team.some((creature) => creature.id === id) ||
    state.reserves.some((creature) => creature.id === id);
    suffix++
  )
    id = `recruit-${state.revision}-${suffix}`;
  const incoming = { id, species: kind, health: species(kind).health, block: 0, attacked: false };
  const lineup = recruitLineup(state, incoming, replacement);
  if (replacement) {
    const active = state.team.findIndex((unit) => unit.id === replacement);
    if (active >= 0) state.team[active] = incoming;
    else state.reserves[state.reserves.findIndex((unit) => unit.id === replacement)] = incoming;
  } else {
    if (lineup.includes(incoming.id)) state.team.push(incoming);
    else state.reserves.push(incoming);
  }
  prepareLineup(state, lineup);
}
function prepareLineup(state: GameState, ids: string[]) {
  const all = [...state.team, ...state.reserves];
  state.team = ids.map((id) => all.find((c) => c.id === id)!);
  state.reserves = all.filter((c) => !ids.includes(c.id));
  rebuildCards(state);
}
export function rebuildCards(state: GameState) {
  const previous = state.cards;
  const previousById = new Map<string, Card[]>();
  for (const card of previous) {
    const matching = previousById.get(card.id);
    if (matching) matching.push(card);
    else previousById.set(card.id, [card]);
  }
  const cards: Card[] = [];
  for (const creature of state.team)
    for (const card of ownedCards(creature.id, creature.species))
      cards.push(
        previousById
          .get(card.id)
          ?.find((old) => old.ownerId === card.ownerId && old.definitionId === card.definitionId) ?? card,
      );
  state.cards = cards;
  if (state.battle) {
    state.battle.hand = [];
    state.battle.buffer = [];
    state.battle.discard = [];
    state.battle.draw = state.cards.map((c) => c.id);
  }
}
export function formationForSwap(
  all: import("./types").Creature[],
  active: string[],
  outgoing: string,
  incoming: string,
) {
  const next = all.find((unit) => unit.id === incoming)!;
  if (species(next.species).legendary) return [next.id];
  const index = active.indexOf(outgoing);
  const ids = active.filter((id) => !species(all.find((unit) => unit.id === id)!.species).legendary);
  if (index < 0 || ids.length !== active.length) ids.push(incoming);
  else ids[index] = incoming;
  return ids;
}
function setFormation(state: GameState, ids: string[], events: GameEvent[] = [], fromCard = false) {
  const all = [...state.team, ...state.reserves];
  const previous = state.cards;
  const activeIds = new Set(ids);
  const departing = new Set<string>();
  for (const unit of state.team) if (!activeIds.has(unit.id)) departing.add(unit.id);
  state.team = ids.map((id) => all.find((unit) => unit.id === id)!);
  state.reserves = all.filter((unit) => !activeIds.has(unit.id));
  const retained: Card[] = [];
  const slots: Card[] = [];
  const previousOwners = new Set<string | null>();
  const used = new Set<string>();
  for (const card of previous) {
    previousOwners.add(card.ownerId);
    if (card.ownerId === null || activeIds.has(card.ownerId)) {
      retained.push(card);
      used.add(card.id);
    }
    if (card.ownerId !== null && departing.has(card.ownerId) && !card.temporary) slots.push(card);
  }
  const needed: Card[] = [];
  for (const unit of state.team)
    if (!previousOwners.has(unit.id)) needed.push(...ownedCards(unit.id, unit.species));
  const mapped = needed.map((card, index) => {
    let id = slots[index]?.id ?? card.id;
    for (let serial = 0; used.has(id); serial++) id = `slot-${state.revision}-${index}-${serial}`;
    used.add(id);
    return { ...card, id };
  });
  // New permanent kits take priority over the newest generated copies at the battle limit.
  const overflow = Math.max(0, retained.length + mapped.length - MAX_BATTLE_CARDS);
  const removed = new Set<string>();
  if (overflow) {
    let remaining = overflow;
    for (let index = retained.length - 1; index >= 0 && remaining > 0; index--) {
      const card = retained[index]!;
      if (card.temporary) {
        removed.add(card.id);
        remaining--;
      }
    }
  }
  state.cards = [...(removed.size ? retained.filter((card) => !removed.has(card.id)) : retained), ...mapped];
  if (state.battle) {
    const kept = new Set(state.cards.map((card) => card.id));
    const changed = fromCard ? new Set(mapped.map((card) => card.id)) : undefined;
    filterCardZones(state.battle, (id) => kept.has(id) && (!changed || !changed.has(id)));
    if (mapped.length) {
      const zoned = new Set<string>();
      for (const zone of [state.battle.draw, state.battle.hand, state.battle.buffer, state.battle.discard])
        for (const id of zone) zoned.add(id);
      const added: string[] = [];
      for (const card of mapped) if (!zoned.has(card.id)) added.push(card.id);
      if (added.length) state.battle.draw = shuffle(state, [...state.battle.draw, ...added]);
    }
    for (const enemy of state.battle.enemies) if (departing.has(enemy.targetId)) enemy.targetId = ids[0]!;
    removeDepartedMinions(state);
    fillHand(state);
    recycleDiscard(state);
  }
  events.push({ kind: "action", actionType: "swap", actorId: ids[0]!, text: "Your formation changes" });
}
/** Knockout replacement is derived from the committed roster, including after resume. */
export function pendingReplacement(state: GameState) {
  return state.phase === "battle" && state.reserves.some((unit) => unit.health > 0)
    ? state.team.find((unit) => unit.health <= 0)
    : undefined;
}
/** The guide can lead the arrival or accompany it; inactive backups supply no protection. */
export function mountainGuide(
  state: GameState,
  incoming: Combatant,
  previous: readonly Combatant[],
  events: GameEvent[],
) {
  if (state.phase !== "battle" || incoming.health <= 0) return;
  const allied = isRosterCreature(incoming);
  const row = allied ? state.team : state.battle.enemies;
  const guides = [...row];
  for (const unit of previous) if (!row.some((current) => current.id === unit.id)) guides.push(unit);
  for (const guide of guides) {
    if (guide.health <= 0) continue;
    const amount = passiveAmount(allied ? state : undefined, guide.species, "mountainGuide");
    if (!amount) continue;
    events.push({
      kind: "action",
      actionType: "support",
      actorId: guide.id,
      targetId: incoming.id,
      text: `Mountain Guide protects ${unitName(incoming)}`,
    });
    grantBlock(state, incoming, amount, events);
  }
}
/** Knockout replacements retain slots; abilities shuffle the incoming kit into the draw pile. */
export function swapBackup(
  state: GameState,
  activeId: string,
  backupId: string,
  events: GameEvent[],
  fromCard = false,
) {
  const index = state.team.findIndex((unit) => unit.id === activeId);
  const backupIndex = state.reserves.findIndex((unit) => unit.id === backupId);
  const outgoing = state.team[index];
  const incoming = state.reserves[backupIndex]!;
  const previous = [...state.team];
  if (!outgoing || species(incoming.species).legendary || species(outgoing.species).legendary) {
    const formation = formationForSwap(
      [...state.team, ...state.reserves],
      state.team.map((unit) => unit.id),
      activeId,
      backupId,
    );
    if (fromCard)
      for (const unit of state.team) if (!formation.includes(unit.id)) cleanseDeparture(state, unit, events);
    setFormation(state, formation, events, fromCard);
  } else {
    if (fromCard) cleanseDeparture(state, outgoing, events);
    state.team[index] = incoming;
    state.reserves[backupIndex] = outgoing;
    const removed = new Set<string>();
    for (const card of state.cards) if (card.ownerId === outgoing.id && card.temporary) removed.add(card.id);
    if (removed.size) state.cards = state.cards.filter((card) => !removed.has(card.id));
    const oldDefs = speciesCards(outgoing.species);
    const newDefs = speciesCards(incoming.species);
    const replaced = state.cards.filter((card) => card.ownerId === outgoing.id);
    for (const card of replaced) {
      card.definitionId = newDefs[oldDefs.findIndex((def) => def.id === card.definitionId)]!.id;
      card.ownerId = incoming.id;
      card.level = 0;
    }
    if (state.battle) {
      if (removed.size) filterCardZones(state.battle, (id) => !removed.has(id));
      for (const enemy of state.battle.enemies)
        if (enemy.targetId === outgoing.id) enemy.targetId = incoming.id;
      if (fromCard) {
        const ids = new Set(replaced.map((card) => card.id));
        filterCardZones(state.battle, (id) => !ids.has(id));
        state.battle.draw = shuffle(state, [...state.battle.draw, ...ids]);
      }
      fillHand(state);
      recycleDiscard(state);
    }
    events.push({
      kind: "action",
      actionType: "swap",
      actorId: incoming.id,
      text: `${species(incoming.species).name} replaces ${species(outgoing.species).name}.`,
    });
  }
  if (fromCard && outgoing) {
    if (state.boons.includes("farewell-oar"))
      farewellOar(
        state,
        previous.filter((ally) => !state.team.some((current) => current.id === ally.id)),
        events,
      );
    matchSwapBlock(state, outgoing, incoming, events);
    shareSwapNullify(state, outgoing, incoming, events);
    if (state.boons.includes("rook-of-mercy"))
      rookOfMercy(
        state,
        state.team.filter((ally) => !previous.some((old) => old.id === ally.id)),
        events,
      );
  }
  mountainGuide(state, incoming, previous, events);
  gentlePassage(state, previous, events);
  if (fromCard && state.boons.includes("saddle-pouch")) drawOwner(state, incoming.id, events);
}
export function swapFromCard(
  state: GameState,
  actor: import("./combat/index").Combatant,
  events: GameEvent[],
  backupOnly = false,
  backupId?: string,
) {
  const allied = isRosterCreature(actor);
  const row = allied ? state.team : state.battle!.enemies;
  // A repeat cannot swap an actor that already left the deployed formation.
  if (!row.some((unit) => unit.id === actor.id)) return;
  const backup = allied ? state.reserves.filter((unit) => unit.health > 0) : [];
  if (backup.length) {
    const incoming =
      backupId !== undefined
        ? backup.find((unit) => unit.id === backupId)
        : backup[Math.floor(roll(state, { kind: "index", size: backup.length }) * backup.length)];
    if (!incoming) return;
    swapBackup(state, actor.id, incoming.id, events, true);
    return incoming;
  }
  if (backupOnly) return;
  const others = row.filter((unit) => unit.id !== actor.id && unit.health > 0);
  if (!others.length) return;
  const other = others[Math.floor(roll(state, { kind: "index", size: others.length }) * others.length)]!;
  const from = row.findIndex((unit) => unit.id === actor.id);
  const to = row.findIndex((unit) => unit.id === other.id);
  [row[from], row[to]] = [row[to]!, row[from]!];
  if (allied) {
    cleanseDeparture(state, actor, events);
    farewellOar(state, [actor, other], events);
    matchSwapBlock(state, actor, other, events);
    shareSwapNullify(state, actor, other, events);
    rookOfMercy(state, [actor, other], events);
  }
  events.push({
    kind: "action",
    actionType: "swap",
    actorId: actor.id,
    targetId: other.id,
    text: `${species(actor.species).name} swaps positions with ${species(other.species).name}.`,
  });
  mountainGuide(state, other, row, events);
  return other;
}
