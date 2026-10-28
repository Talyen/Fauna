import { actionValue } from "../ability-rules";
import { takeCardRepeat } from "./card-repeat";
import { battleCardCapacity, createTemporaryCard, draw } from "../card-zones";
import { boonRule, cornucopiaHealing } from "../rules/boons";
import { foodForAllies } from "../card-rules";
import { FOOD_CARDS } from "../content/food";
import { species, type CardDefinition } from "../content";
import { receiveCard } from "../card-zones";
import { roll } from "../random";
import { passiveAmount } from "../progression";
import {
  gainMana,
  grantArmor,
  grantBlock,
  restoreHealth,
  grantTemporaryDodge,
  removeEffects,
  mostInjured,
} from "./index";
import {
  findLivingBattlefield,
  battlefield,
  livingBattlefield,
  healingAllies,
  isDepartedMinion,
} from "../battlefield";
import type { BattleState, Creature, GameEvent } from "../types";

export function createFood(
  state: BattleState,
  actor: Creature,
  count: number,
  events: GameEvent[],
  destination: "hand" | "deck" = "hand",
) {
  let created = 0;
  while (created < count && battleCardCapacity(state) > 0) {
    const def =
      FOOD_CARDS[Math.floor(roll(state, { kind: "index", size: FOOD_CARDS.length }) * FOOD_CARDS.length)]!;
    const card = createTemporaryCard(state, {
      definitionId: def.id,
      ownerId: null,
      level: 0,
    })!;
    if (destination === "deck") state.battle.draw.push(card.id);
    else receiveCard(state, card.id);
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

/** Opening supplies join the deck before its shuffle and ordinary opening draws. */
export function wellProvisioned(state: BattleState, events: GameEvent[]) {
  for (const provider of state.team) {
    if (provider.health <= 0) continue;
    const amount = passiveAmount(state, provider.species, "wellProvisioned");
    if (amount > 0) createFood(state, provider, amount, events, "deck");
  }
}

/** Shared Food uses team repeats, without a creature's repeats, free-card charges or passive. */
export function useFood(
  state: BattleState,
  def: CardDefinition,
  targetId: string | undefined,
  events: GameEvent[],
) {
  const recipient =
    targetId === undefined
      ? undefined
      : findLivingBattlefield(state, "player", (unit) => unit.id === targetId);
  const presenter = recipient ?? state.team.find((unit) => unit.health > 0)!;
  events.push({
    kind: "action",
    actionType: "support",
    actorId: presenter.id,
    targetId: recipient?.id,
    text: `Use ${def.name}`,
  });
  const value = actionValue(
    { definitionId: def.id, level: 0, ownerId: null, id: def.id },
    { species: null, attacked: false },
    state,
  );
  const repeat = takeCardRepeat(state, "player");
  for (let play = 0; play < (repeat ? 2 : 1); play++) {
    if (play === 1)
      events.push({
        kind: "action",
        actionType: "support",
        actorId: presenter.id,
        text: `${def.name} repeats`,
      });
    if (def.effect === "mana") {
      gainMana(state, value, events);
      if (def.id === "food-mana-berries" && state.boons.includes("cornucopia")) {
        let healing: number | undefined;
        for (const ally of healingAllies(state)) {
          restoreHealth(ally, (healing ??= cornucopiaHealing(state)), events, false, state, true);
          if (state.boons.includes("velvet-whisk"))
            grantTemporaryDodge(ally, boonRule("velvet-whisk").dodge, events);
        }
      }
    } else {
      const recipients = foodForAllies(def, state)
        ? def.effect === "heal"
          ? healingAllies(state)
          : livingBattlefield(state, "player")
        : recipient
          ? [recipient]
          : [];
      for (const target of recipients) {
        if (target.health <= 0 || isDepartedMinion(state, target)) continue;
        if (def.effect === "heal") restoreHealth(target, value, events, false, state, true);
        else if (def.effect === "guard") grantBlock(state, target, value, events);
        if (state.boons.includes("crown-waffle-iron") && target.block > 0)
          restoreHealth(
            target,
            target.block * (state.boons.includes("nectar-dipper") ? 2 : 1),
            events,
            false,
            state,
            true,
          );
        if (state.boons.includes("velvet-whisk"))
          grantTemporaryDodge(target, boonRule("velvet-whisk").dodge, events);
      }
    }
    if (state.boons.includes("orchard-ladder-charm"))
      for (const ally of state.reserves)
        if (ally.health > 0)
          restoreHealth(ally, boonRule("orchard-ladder-charm").healing, events, false, state);
    if (state.boons.includes("spore-trivet"))
      for (const ally of livingBattlefield(state, "player"))
        if ((ally.combat?.burn ?? 0) > 0)
          removeEffects(ally, "cleanse", 1, events, state, "burn", undefined, false);
  }
  if (state.boons.includes("hearthcap-kettle")) {
    const ally = mostInjured(livingBattlefield(state, "player"));
    if (ally) removeEffects(ally, "cleanse", boonRule("hearthcap-kettle").cleanse, events, state);
  }
  if (state.boons.includes("sovereign-toast-rack"))
    for (const ally of battlefield(state, "player"))
      if (ally.health > 0) grantArmor(state, ally, boonRule("sovereign-toast-rack").armor, events);
  if (state.boons.includes("field-lunch-basket")) draw(state, boonRule("field-lunch-basket").draw, events);
}
