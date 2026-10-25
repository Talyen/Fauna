import { takeCardRepeat } from "./card-repeat";
import { battleCardCapacity } from "../card-zones";
import { FOOD_CARDS } from "../content/food";
import { species, type CardDefinition } from "../content";
import { receiveCard } from "../card-zones";
import { roll } from "../random";
import { gainMana, grantBlock, restoreHealth } from "./index";
import { battlefield } from "../battlefield";
import type { BattleState, Creature, GameEvent } from "../types";

export function createFood(state: BattleState, actor: Creature, count: number, events: GameEvent[]) {
  let created = 0;
  while (
    created < count &&
    battleCardCapacity(state) > 0 &&
    state.battle.copySerial < Number.MAX_SAFE_INTEGER
  ) {
    const def =
      FOOD_CARDS[Math.floor(roll(state, { kind: "index", size: FOOD_CARDS.length }) * FOOD_CARDS.length)]!;
    const card = {
      id: `copy-${state.battle.copySerial++}`,
      definitionId: def.id,
      ownerId: null,
      level: 0,
      temporary: true as const,
    };
    state.cards.push(card);
    receiveCard(state, card.id);
    created++;
  }
  if (created)
    events.push({
      kind: "action",
      actionType: "support",
      actorId: actor.id,
      amount: created,
      text: `${species(actor.species).name} creates ${created} Food cards`,
    });
}

/** Shared Food uses team repeats, without a creature's repeats, free-card charges or passive. */
export function useFood(
  state: BattleState,
  def: CardDefinition,
  targetId: string | undefined,
  events: GameEvent[],
) {
  const recipient = battlefield(state, "player").find((unit) => unit.id === targetId && unit.health > 0);
  const presenter = recipient ?? state.team.find((unit) => unit.health > 0)!;
  events.push({
    kind: "action",
    actionType: "support",
    actorId: presenter.id,
    targetId: recipient?.id,
    text: `Use ${def.name}`,
  });
  const repeat = takeCardRepeat(state, "player");
  for (let play = 0; play < (repeat ? 2 : 1); play++) {
    if (play === 1)
      events.push({
        kind: "action",
        actionType: "support",
        actorId: presenter.id,
        text: `${def.name} repeats`,
      });
    if (def.effect === "mana") gainMana(state, def.value, events);
    else if (recipient && def.effect === "heal")
      restoreHealth(recipient, def.value, events, false, state, true);
    else if (recipient && def.effect === "guard") grantBlock(state, recipient, def.value, events);
  }
}
