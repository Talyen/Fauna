import { permanentCardCopies } from "./card-kit";
import { isRosterCreature } from "./battlefield";
import { drawOwner, recycleDiscard, fillHand, filterCardZones, MAX_BATTLE_CARDS } from "./card-zones";
import { removeDepartedMinions } from "./combat/legendary";
import { grantBlock, restoreHealth, removeEffects } from "./combat/index";
import { unitName, type Combatant } from "./combat/state";
import { passiveAmount } from "./progression";
import { shuffle, roll } from "./random";
import { speciesCards, species } from "./content";
import type { Card, GameEvent, GameState } from "./types";

/** Both sides of the exchange provide passage, including Dulcera's own departure or arrival. */
export function gentlePassage(state: GameState, previous: GameState["team"], events: GameEvent[]) {
  if (state.phase !== "battle") return;
  const providers = new Map([...previous, ...state.team].map((unit) => [unit.id, unit]));
  const entering = state.team.filter((unit) => !previous.some((old) => old.id === unit.id));
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
export function cleanseDeparture(state: GameState, outgoing: Combatant, events: GameEvent[]) {
  if (state.phase !== "battle" || outgoing.health <= 0 || !state.boons.includes("prayer-sailboat")) return;
  for (const status of ["stun", "freeze"] as const)
    if (
      outgoing.health > 0 &&
      (outgoing.combat?.controlled === status || (outgoing.combat?.[status] ?? 0) > 0)
    )
      removeEffects(outgoing, "cleanse", 1, events, state, status);
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
export function rosterHasSpecies(
  state: Pick<GameState, "team" | "reserves">,
  kind: import("./content").SpeciesId,
) {
  return [...state.team, ...state.reserves].some((unit) => unit.species === kind);
}
export function ownedCards(id: string, kind: GameState["team"][number]["species"]): Card[] {
  const copies = permanentCardCopies(kind);
  return speciesCards(kind).flatMap((c) =>
    Array.from({ length: copies }, (_, index) => ({
      id: `${id}:${c.id}${index ? ":2" : ""}`,
      definitionId: c.id,
      ownerId: id,
      level: 0,
    })),
  );
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
    : [...active];
}
/** Joining a roster changes individuals and deployment; Collection progress is granted separately. */
export function addRecruit(state: GameState, kind: import("./content").SpeciesId, replacement?: string) {
  // Repeat discoveries improve Collection rank without replacing or refreshing an individual.
  if (rosterHasSpecies(state, kind)) return;
  const all = [...state.team, ...state.reserves];
  let id = `recruit-${state.revision}`;
  for (let suffix = 1; all.some((creature) => creature.id === id); suffix++)
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
  state.cards = state.team
    .flatMap((c) => ownedCards(c.id, c.species))
    .map(
      (card) =>
        previous.find(
          (old) =>
            old.id === card.id && old.ownerId === card.ownerId && old.definitionId === card.definitionId,
        ) ?? card,
    );
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
  const departing = new Set(state.team.filter((unit) => !ids.includes(unit.id)).map((unit) => unit.id));
  if (fromCard)
    for (const unit of state.team) if (departing.has(unit.id)) cleanseDeparture(state, unit, events);
  state.team = ids.map((id) => all.find((unit) => unit.id === id)!);
  state.reserves = all.filter((unit) => !ids.includes(unit.id));
  const retained = previous.filter((card) => card.ownerId === null || ids.includes(card.ownerId));
  const slots = previous.filter(
    (card) => card.ownerId !== null && departing.has(card.ownerId) && !card.temporary,
  );
  const needed = state.team
    .filter((unit) => !previous.some((card) => card.ownerId === unit.id))
    .flatMap((unit) => ownedCards(unit.id, unit.species));
  const used = new Set(retained.map((card) => card.id));
  const mapped = needed.map((card, index) => {
    let id = slots[index]?.id ?? card.id;
    for (let serial = 0; used.has(id); serial++) id = `slot-${state.revision}-${index}-${serial}`;
    used.add(id);
    return { ...card, id };
  });
  // New permanent kits take priority over the newest generated copies at the battle limit.
  const overflow = Math.max(0, retained.length + mapped.length - MAX_BATTLE_CARDS);
  const removed = new Set(
    overflow
      ? retained
          .filter((card) => card.temporary)
          .slice(-overflow)
          .map((card) => card.id)
      : [],
  );
  state.cards = [...retained.filter((card) => !removed.has(card.id)), ...mapped];
  if (state.battle) {
    const kept = new Set(state.cards.map((card) => card.id));
    const changed = new Set(mapped.map((card) => card.id));
    filterCardZones(state.battle, (id) => kept.has(id) && (!fromCard || !changed.has(id)));
    const zoned = new Set([
      ...state.battle.draw,
      ...state.battle.hand,
      ...state.battle.buffer,
      ...state.battle.discard,
    ]);
    const added = mapped.filter((card) => !zoned.has(card.id)).map((card) => card.id);
    if (added.length) state.battle.draw = shuffle(state, [...state.battle.draw, ...added]);
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
  const guides = [...row, ...previous.filter((unit) => !row.some((current) => current.id === unit.id))];
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
    setFormation(
      state,
      formationForSwap(
        [...state.team, ...state.reserves],
        state.team.map((unit) => unit.id),
        activeId,
        backupId,
      ),
      events,
      fromCard,
    );
  } else {
    state.team[index] = incoming;
    state.reserves[backupIndex] = outgoing;
    const removed = new Set(
      state.cards.filter((card) => card.ownerId === outgoing.id && card.temporary).map((card) => card.id),
    );
    state.cards = state.cards.filter((card) => !removed.has(card.id));
    const oldDefs = speciesCards(outgoing.species);
    const newDefs = speciesCards(incoming.species);
    const replaced = state.cards.filter((card) => card.ownerId === outgoing.id);
    for (const card of replaced) {
      card.definitionId = newDefs[oldDefs.findIndex((def) => def.id === card.definitionId)]!.id;
      card.ownerId = incoming.id;
      card.level = 0;
    }
    if (state.battle) {
      filterCardZones(state.battle, (id) => !removed.has(id));
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
    cleanseDeparture(state, outgoing, events);
    matchSwapBlock(state, outgoing, incoming, events);
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
    matchSwapBlock(state, actor, other, events);
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
