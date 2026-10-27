import { foodForAllies } from "../game/card-rules";
import { boonRule } from "../game/rules/boons";
import {
  foodDodgeBenefit,
  healingBenefit,
  ordinaryAttackFacts,
  type OrdinaryHit,
} from "../game/ability-facts";
import {
  battleCardCapacity,
  drawHasAnotherCard,
  hasDiscardDrawCard,
  journeyReturnHasDraw,
} from "../game/card-zones";
import { RESURRECTION_HEALTH_PERCENT } from "../game/resurrection-rules";
import { battlefield, healingAllies } from "../game/battlefield";
import { cardHasKeyword, hasTalent, passiveAmount } from "../game/progression";
import {
  controlled,
  hasHarmfulEffects,
  hasBeneficialEffects,
  mostInjured,
  maximumHealth,
  STACK_LIMIT,
} from "../game/combat/state";
import { actionValue, cardCost, manaCapacity } from "../game/ability-rules";
import { healingValue, restoration } from "../game/combat/healing-values";
import type { AvailablePlay } from "../game/play-queries";
import type { BattleState, Creature, Enemy } from "../game/types";

export const BATTLE_FINISH_PRIORITY = 1_000_000_000;
const priorities = {
  none: 0,
  summon: 1600,
  summonRecovery: 1200,
  protection: 100,
  pearl: 500,
  resource: 400,
  healing: 3000,
  utility: 150,
  standardUtility: 200,
  controlRemoval: 200,
  redraw: 190,
  defensePurge: 1700,
  purge: 160,
  statusHarvest: 2000,
};
function countMatching<T>(items: readonly T[], predicate: (item: T) => unknown): number {
  let count = 0;
  for (const item of items) if (predicate(item)) count++;
  return count;
}

interface BattleBenefit {
  targetId?: string;
  reason?: string;
  score: number;
}

function ordinaryHitScore(hit: OrdinaryHit) {
  const damagePriority = hit.main ? 1000 : 250;
  const defensePriority = hit.main ? 500 : 125;
  const progress = hit.negated
    ? hit.main
      ? 400
      : 100
    : hit.lost > 0
      ? damagePriority + (hit.lethal ? damagePriority : 0) + Math.min(hit.lost, hit.health)
      : hit.blocked > 0
        ? defensePriority + hit.blocked
        : hit.eroded > 0
          ? 300 + hit.eroded
          : 0;
  return Math.max(progress, hit.usefulExtras ? priorities.standardUtility : 0);
}
/** Share visible target discovery across the hand, without caching mutable state across commands. */
export function battleBenefitFacts(state: BattleState) {
  let injured: boolean | undefined;
  let healing: boolean | undefined;
  const injuredAllies = () =>
    (injured ??= healingAllies(state).some((unit) => unit.health < maximumHealth(unit)));
  const healingOnPlay = () =>
    (healing ??=
      injuredAllies() &&
      ((state.battle.hand.length === 1 &&
        state.team.some((unit) => unit.health > 0 && passiveAmount(state, unit.species, "lastWarmth") > 0)) ||
        (state.battle.cardsPlayedThisTurn === 1 &&
          state.team.some(
            (unit) => unit.health > 0 && passiveAmount(state, unit.species, "livingChorus") > 0,
          )) ||
        (state.battle.cardsPlayedThisTurn === boonRule("resonant-chimes").cards - 1 &&
          state.boons.includes("resonant-chimes") &&
          hasTalent(state, "mana.arcane-mending"))));
  let enemies: Enemy[] | undefined;
  let allies: (Creature | Enemy)[] | undefined;
  let recoverable: Map<string | undefined, boolean> | undefined;
  return {
    get injuredAllies() {
      return injuredAllies();
    },
    get healingOnPlay() {
      return healingOnPlay();
    },
    recoverable: (actorId?: string) => {
      recoverable ??= new Map();
      let result = recoverable.get(actorId);
      if (result === undefined) {
        result = hasDiscardDrawCard(state, actorId);
        recoverable.set(actorId, result);
      }
      return result;
    },
    livingEnemies: () => (enemies ??= battlefield(state, "enemy").filter((unit) => unit.health > 0)),
    livingAllies: () => (allies ??= battlefield(state, "player").filter((unit) => unit.health > 0)),
  };
}

/** A self-only draw still needs a draw reward to justify spending the card. */
function usefulDraw(state: BattleState, play: AvailablePlay): boolean {
  return !!play.def.effects?.some(
    (effect) =>
      (effect.kind === "draw" || effect.kind === "drawKeyword") &&
      effect.amount > 0 &&
      (drawHasAnotherCard(state, play.card, effect) ||
        (!play.def.consume &&
          (effect.kind === "draw" || cardHasKeyword(play.card, effect.keyword)) &&
          (state.boons.includes("mineral-bookend") ||
            (state.boons.includes("dune-shuttle") &&
              state.team.some((unit) => unit.id === play.card.ownerId && unit.health > 0))))),
  );
}

function ordinaryDrawBenefit(state: BattleState, play: AvailablePlay, amount: number): boolean {
  return (
    drawHasAnotherCard(state, play.card, { kind: "draw", amount }) ||
    state.boons.includes("mineral-bookend") ||
    state.boons.includes("dune-shuttle")
  );
}

/** A spent primary effect can still justify a play through healing or a useful draw. */
function supplementalScore(
  state: BattleState,
  play: AvailablePlay,
  facts: ReturnType<typeof battleBenefitFacts>,
  amount: number,
): number {
  if (facts.healingOnPlay) return priorities.healing + amount;
  if (
    play.def.effects?.some((effect) => effect.kind === "blind") &&
    facts.livingEnemies().some((enemy) => !enemy.combat.blind)
  )
    return priorities.utility + amount;
  for (const effect of play.def.effects ?? []) {
    if (effect.kind !== "heal" || effect.target === "recipient") continue;
    const { restored, utility } = healingBenefit(state, play.actor, effect.amount, undefined);
    if (restored > 0) return priorities.healing + restored;
    if (utility > 0) return priorities.utility + utility;
  }
  if (
    facts.injuredAllies &&
    hasTalent(state, "mana.arcane-mending") &&
    play.def.effects?.some((effect) => effect.kind === "mana" && effect.amount > 0) &&
    state.battle.mana - cardCost(play.card, state, play.def, play.actor) < manaCapacity(state)
  )
    return priorities.healing + amount;
  return usefulDraw(state, play) ? priorities.standardUtility + amount : 0;
}

/** Score visible benefits without sampling hidden outcomes or running combat. */
export function battleBenefits(
  state: BattleState,
  play: AvailablePlay,
  facts: ReturnType<typeof battleBenefitFacts>,
): BattleBenefit[] {
  const { card, actor, def } = play;
  const value = actionValue(card, actor, state);
  let healingValueOnPlay: number | undefined;
  const healing = () =>
    (healingValueOnPlay ??= restoration(
      actor,
      def.effects?.reduce(
        (sum, effect) =>
          sum +
          (effect.kind === "heal" && effect.target !== "recipient"
            ? restoration(actor, healingValue(state, actor, effect.amount)).rounded
            : 0),
        0,
      ) ?? 0,
    ).gain);
  const support = (
    priority: keyof typeof priorities,
    amount = 0,
    targetId?: string,
    reason?: string,
  ): BattleBenefit[] => [
    {
      score:
        priority === "none"
          ? supplementalScore(state, play, facts, amount)
          : priorities[priority] + amount * (priority === "controlRemoval" ? 100 : 1),
      targetId,
      reason,
    },
  ];
  const allies = facts.livingAllies;
  const controlRemoval = (amount: number) => support(amount > 0 ? "controlRemoval" : "none", amount);
  const dodgeSupport = (useful: number) => support(useful > 0 ? "utility" : "none", useful > 0 ? useful : 0);
  switch (def.effect) {
    case "procession": {
      const echoes = (state.battle.minions ?? []).filter(
        (unit) => unit.minion.ownerId === actor.id && unit.health > 0,
      );
      return support(
        echoes.length < 2
          ? "summon"
          : echoes.some((unit) => unit.health < unit.maxHealth)
            ? "summonRecovery"
            : echoes.some((unit) => !controlled(unit))
              ? "protection"
              : "none",
      );
    }
    case "createFood":
    case "createPearls":
      return support(battleCardCapacity(state) > 0 ? "resource" : "none");
    case "pearl":
      return support("pearl");
    case "attack": {
      const enemies = facts.livingEnemies();
      const cost = cardCost(card, state, def, actor);
      const attacks = enemies.map((enemy) => ({
        enemy,
        outcomes: ordinaryAttackFacts(state, actor, def, value, enemy, cost),
      }));
      const cleanse = def.effects?.some(
        (effect) =>
          effect.kind === "cleanse" &&
          (effect.target === "allAllies"
            ? allies().some(hasHarmfulEffects)
            : actor.health > 0 && hasHarmfulEffects(actor)),
      );
      const attackScore = (outcomes: OrdinaryHit[]) =>
        outcomes.reduce(
          (sum, hit) => sum + Math.max(ordinaryHitScore(hit), cleanse ? priorities.standardUtility : 0),
          0,
        ) / outcomes.length;
      const remaining = attacks.filter(({ enemy }) => !enemy.minion);
      const lethal = (attack: (typeof attacks)[number]) => attack.outcomes.every((outcome) => outcome.lethal);
      const winning =
        !actor.combat?.blind &&
        remaining.length > 0 &&
        (def.target === "allEnemies"
          ? remaining.every(lethal)
          : def.target === "randomEnemy"
            ? attacks.every((attack) => !attack.enemy.minion && lethal(attack)) && remaining.length === 1
            : false);
      if (def.target === "allEnemies" || def.target === "randomEnemy")
        return [
          {
            score:
              (winning ? BATTLE_FINISH_PRIORITY : 0) +
              attacks.reduce((sum, attack) => sum + attackScore(attack.outcomes), 0) /
                (def.target === "randomEnemy" && attacks.length ? attacks.length : 1),
            reason:
              def.target === "randomEnemy"
                ? "Use the average visible benefit across random targets"
                : winning
                  ? "Attempt to finish every remaining enemy on ordinary hits"
                  : "Damage enemies; give roster creatures priority over Minions",
          },
        ];
      return attacks.map((attack) => {
        const { enemy } = attack;
        const finish = !actor.combat?.blind && remaining.length === 1 && !enemy.minion && lethal(attack);
        return {
          score: (finish ? BATTLE_FINISH_PRIORITY : 0) + attackScore(attack.outcomes),
          targetId: enemy.id,
          reason: finish
            ? "Attempt to finish the last enemy before healing or attacking Minions"
            : enemy.minion
              ? "Reduce a Minion threat"
              : "Make progress against an enemy creature",
        };
      });
    }
    case "heal": {
      if (def.target === "allAllies" || foodForAllies(def, state)) {
        const automaticRecipients = healingAllies(state);
        let restored = 0;
        let benefitUtility = 0;
        let dodgeUtility = 0;
        for (const ally of automaticRecipients) {
          const benefit = healingBenefit(state, ally, value, play.def.effects);
          restored += benefit.restored;
          benefitUtility += benefit.utility;
          dodgeUtility += foodDodgeBenefit(state, def, ally);
        }
        const utility = benefitUtility + dodgeUtility;
        if (restored > 0) return support("healing", restored);
        if (utility > 0) return support("utility", utility);
        if (
          def.effects?.some((effect) => effect.kind === "blind") &&
          facts.livingEnemies().some((enemy) => !enemy.combat.blind)
        )
          return support("utility");
        return support(usefulDraw(state, play) ? "standardUtility" : "none");
      }
      const recipients =
        def.target === "self"
          ? [actor]
          : def.target === "mostInjured"
            ? [mostInjured(healingAllies(state))!]
            : def.target === "injured"
              ? allies().filter((ally) => ally.health < maximumHealth(ally))
              : allies();
      return recipients.flatMap((ally) => {
        const benefit = healingBenefit(state, ally, value, play.def.effects);
        const { restored } = benefit;
        const utility = benefit.utility + foodDodgeBenefit(state, def, ally);
        return support(
          restored > 0 ? "healing" : utility > 0 ? "utility" : "none",
          restored > 0 ? restored : utility,
          def.target && def.target !== "injured" ? undefined : ally.id,
        );
      });
    }
    case "mana": {
      const cost = cardCost(card, state, def, actor);
      const regained = Math.min(value, manaCapacity(state) - state.battle.mana + cost);
      const net = regained - cost;
      const mending = regained > 0 && hasTalent(state, "mana.arcane-mending") && facts.injuredAllies;
      return support(
        net > 0 ? "resource" : mending || facts.healingOnPlay ? "healing" : "none",
        net > 0 ? net : mending || facts.healingOnPlay ? regained : 0,
      );
    }
    case "teamClearBlind": {
      const blinded = countMatching(allies(), (unit) => unit.combat?.blind);
      return blinded > 0
        ? controlRemoval(blinded)
        : def.draw && ordinaryDrawBenefit(state, play, value)
          ? support("standardUtility", value)
          : controlRemoval(0);
    }
    case "repeatNextCard":
      return support(state.battle.repeatNext.player ? "none" : "standardUtility");
    case "springbound": {
      const frozen = countMatching(allies(), (unit) => (unit.combat?.freeze ?? 0) > 0);
      return frozen > 0
        ? controlRemoval(frozen)
        : dodgeSupport(Math.min(value, 70 - (actor.combat?.temporaryDodge ?? 0)));
    }
    case "teamThaw":
      return controlRemoval(countMatching(allies(), (unit) => (unit.combat?.freeze ?? 0) > 0));
    case "recover": {
      const useful = facts.recoverable(def.allyOnly ? actor.id : undefined);
      if (def.target === "ally") {
        const healing =
          def.effects?.reduce(
            (sum, effect) =>
              sum + (effect.kind === "heal" && effect.target === "recipient" ? effect.amount : 0),
            0,
          ) ?? 0;
        return allies().flatMap((ally) => {
          const { restored, utility } = healingBenefit(state, ally, healing, play.def.effects);
          return support(
            restored > 0 ? "healing" : useful ? "standardUtility" : utility > 0 ? "utility" : "none",
            restored > 0 ? restored : utility,
            ally.id,
          );
        });
      }
      // The played card enters Discard before recovery, so it can heal its own
      // living owner through Lost and Found even when Discard was empty.
      const selfRecovery =
        !useful && !def.allyOnly && !def.consume && card.ownerId === actor.id
          ? state.team.reduce(
              (sum, unit) => sum + (unit.health > 0 ? passiveAmount(state, unit.species, "lostAndFound") : 0),
              0,
            )
          : 0;
      const selfHealing = restoration(actor, healingValue(state, actor, selfRecovery)).gain;
      const loomDraw = !useful && !def.allyOnly && !def.consume && journeyReturnHasDraw(state, card.ownerId);
      return support(
        selfHealing > 0 ? "healing" : useful || loomDraw ? "standardUtility" : "none",
        selfHealing,
      );
    }
    case "dodge":
      return dodgeSupport(
        (def.target === "allAllies" ? allies() : [actor]).reduce(
          (sum, unit) => sum + Math.min(value, 70 - (unit.combat?.temporaryDodge ?? 0)),
          0,
        ),
      );
    case "redraw":
      return support(state.battle.hand.length > 1 ? "redraw" : "none");
    case "draw":
      return support(
        healing() > 0
          ? "healing"
          : ordinaryDrawBenefit(state, play, value) ||
              state.battle.minions?.some(
                (unit) => unit.minion.ownerId === actor.id && unit.health > 0 && !controlled(unit),
              )
            ? "standardUtility"
            : "none",
        healing() > 0 ? healing() : value,
      );
    case "teamBlind": {
      const useful = countMatching(facts.livingEnemies(), (enemy) => !enemy.combat.blind);
      return support(useful > 0 ? "utility" : "none", useful);
    }
    case "teamPurge": {
      const enemies = facts.livingEnemies();
      const useful = countMatching(enemies, hasBeneficialEffects);
      const defense = useful > 0 && enemies.some((enemy) => enemy.block > 0 || enemy.combat.armor > 0);
      return support(
        useful > 0 ? (defense ? "defensePurge" : "purge") : "none",
        useful,
        undefined,
        "Remove visible defenses before spending Mana on blocked attacks",
      );
    }
    case "reflectAttack":
      return support(actor.combat?.attackReflection ? "none" : "protection", 1);
    case "resurrect":
      return [...state.team, ...state.reserves]
        .filter((unit) => unit.health === 0)
        .flatMap((unit) =>
          support(
            "healing",
            Math.max(1, Math.round((maximumHealth(unit) * RESURRECTION_HEALTH_PERCENT) / 100)),
            unit.id,
          ),
        );
    case "dreamDouble": {
      const thorns = Math.min(value, STACK_LIMIT - (actor.combat?.thorns ?? 0));
      return support(!actor.combat?.negate ? "resource" : thorns > 0 ? "protection" : "none", thorns);
    }
    case "sparkDecoy": {
      const useful = countMatching(facts.livingEnemies(), (enemy) => enemy.combat.burn < STACK_LIMIT);
      return support(!actor.combat?.negate || useful > 0 ? "utility" : "none", useful * value);
    }
    case "nightmareHarvest": {
      const useful = countMatching(allies(), hasHarmfulEffects);
      return support(useful > 0 ? "statusHarvest" : "none", useful);
    }
    case "teamCleanse":
      return support(
        allies().some(hasHarmfulEffects)
          ? "utility"
          : facts.healingOnPlay
            ? "healing"
            : usefulDraw(state, play)
              ? "utility"
              : "none",
      );
    case "guard":
    case "redistributeBlock":
    case "teamProtection": {
      if (def.effect === "guard" && def.target !== "allAllies" && !foodForAllies(def, state)) {
        const protection =
          def.effects?.reduce((sum, effect) => {
            if (effect.kind === "reflect")
              return (
                sum + Number(!(effect.status === "burn" ? actor.combat?.reflectBurn : actor.combat?.reflect))
              );
            if (effect.kind === "nullifyFreeze") return sum + Number(!actor.combat?.nullifyFreeze);
            if (effect.kind === "status")
              return (
                sum +
                Math.min(
                  effect.amount,
                  (effect.status === "dodge" ? 70 : STACK_LIMIT) - (actor.combat?.[effect.status] ?? 0),
                )
              );
            return sum;
          }, 0) ?? 0;
        const cleanse =
          def.effects?.some((effect) => effect.kind === "cleanse" && hasHarmfulEffects(actor)) ?? false;
        return (def.target === "self" ? [actor] : allies()).flatMap((ally) => {
          const useful = Math.min(value, STACK_LIMIT - ally.block) + foodDodgeBenefit(state, def, ally);
          return support(
            healing() > 0 ? "healing" : useful + protection > 0 || cleanse ? "protection" : "none",
            healing() > 0 ? healing() : useful + protection,
            def.target === "self" ? undefined : ally.id,
          );
        });
      }
      const useful = allies().reduce(
        (sum, ally) =>
          sum +
          Math.min(value, STACK_LIMIT - ally.block) +
          foodDodgeBenefit(state, def, ally) +
          (def.effect === "teamProtection" ? Math.min(value, STACK_LIMIT - (ally.combat?.thorns ?? 0)) : 0),
        0,
      );
      return support(useful > 0 ? "protection" : "none", useful);
    }
    case "nullify": {
      const useful = countMatching(allies(), (unit) => !unit.combat?.nullify);
      return support(useful > 0 ? "utility" : "none", useful);
    }
    case "swapDodge":
      return support(
        state.reserves.some((unit) => unit.health > 0) || allies().some((unit) => unit.id !== actor.id)
          ? "utility"
          : "none",
      );
    case "swap":
      if (
        !state.reserves.some((unit) => unit.health > 0) &&
        (def.backupOnly || !state.team.some((unit) => unit.id !== actor.id && unit.health > 0))
      )
        return support(
          def.effects?.some((effect) => effect.kind === "cleanse" && effect.target === "allAllies") &&
            allies().some(hasHarmfulEffects)
            ? "utility"
            : "none",
        );
      return support("utility");
    case "swapChosen":
      return play.commands.flatMap((command) => support("utility", 0, command.targetId));
    case "swapLowest":
      return support(state.reserves.some((unit) => unit.health > 0) ? "utility" : "none");
    default: {
      const unhandled: never = def;
      throw new Error(`Unhandled battle benefit: ${unhandled}`);
    }
  }
}
