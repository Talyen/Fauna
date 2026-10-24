import { healingBenefit, ordinaryAttackFacts, type OrdinaryHit } from "../game/ability-facts";
export type { OrdinaryHit } from "../game/ability-facts";
import { battleCardCapacity, drawHasAnotherCard } from "../game/card-zones";
import { drawableOwnerIds } from "../game/card-actors";
import { RESURRECTION_HEALTH_PERCENT } from "../game/resurrection-rules";

import { battlefield } from "../game/battlefield";
import { creaturePassive, hasTalent } from "../game/progression";
import { hasHarmfulEffects, mostInjured, maximumHealth, STACK_LIMIT } from "../game/combat/state";
import { actionValue, cardCost } from "../game/ability-rules";

import { healingValue, restoration } from "../game/combat/healing-values";
import type { AvailablePlay } from "../game/play-queries";
import type { BattleState, Enemy } from "../game/types";

export type SupportPriority =
  | "none"
  | "summon"
  | "summonRecovery"
  | "protection"
  | "pearl"
  | "resource"
  | "healing"
  | "utility"
  | "standardUtility"
  | "controlRemoval"
  | "redraw"
  | "defensePurge"
  | "purge"
  | "statusHarvest";
export type BattleBenefit = { targetId?: string; reason?: string } & (
  | { kind: "attack"; groups: OrdinaryHit[][]; aggregate: "sum" | "mean"; finish: boolean }
  | { kind: "support"; priority: SupportPriority; amount: number }
);

/** Share visible target discovery across the hand, without caching mutable state across commands. */
export function battleBenefitFacts(state: BattleState) {
  const injuredAllies = battlefield(state, "player").some(
    (unit) => unit.health > 0 && unit.health < maximumHealth(unit),
  );
  const healingOnPlay =
    injuredAllies &&
    ((state.battle.cardsPlayedThisTurn === 1 &&
      state.team.some(
        (unit) =>
          unit.health > 0 &&
          creaturePassive(state, unit.species).effects.some(
            (effect) => effect.kind === "livingChorus" && effect.amount > 0,
          ),
      )) ||
      (state.battle.cardsPlayedThisTurn === 2 &&
        state.boons.includes("resonant-chimes") &&
        hasTalent(state, "mana.arcane-mending")));
  let enemies: Enemy[] | undefined;
  return {
    injuredAllies,
    healingOnPlay,
    livingEnemies: () => (enemies ??= battlefield(state, "enemy").filter((unit) => unit.health > 0)),
  };
}

/** Visible facts and explicit approximations; ranking weights live with the application policy. */
export function battleBenefits(
  state: BattleState,
  play: AvailablePlay,
  facts: ReturnType<typeof battleBenefitFacts>,
): BattleBenefit[] {
  const { card, actor, def } = play;
  const value = actionValue(card, actor, state);
  const healing = restoration(
    actor,
    def.effects?.reduce(
      (sum, effect) =>
        sum +
        (effect.kind === "heal" && effect.target !== "recipient"
          ? restoration(actor, healingValue(state, actor, effect.amount)).rounded
          : 0),
      0,
    ) ?? 0,
  ).gain;
  const support = (
    priority: SupportPriority,
    amount = 0,
    targetId?: string,
    reason?: string,
  ): BattleBenefit[] => [{ kind: "support", priority, amount, targetId, reason }];
  const allies = state.team.filter((unit) => unit.health > 0);
  // Drawing only this card back cannot justify an already capped Dodge grant.
  const usefulDraw = () =>
    !!def.effects?.some((effect) => effect.kind === "draw" && effect.amount > 0) && drawHasAnotherCard(state);
  const dodgeSupport = (useful: number) =>
    support(
      useful > 0 ? "utility" : facts.healingOnPlay ? "healing" : usefulDraw() ? "standardUtility" : "none",
      useful > 0 ? useful : 0,
    );
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
            : "protection",
      );
    }
    case "createFood":
    case "createPearls":
      return support(battleCardCapacity(state) > 0 ? "resource" : "none");
    case "pearl":
      return support("pearl");
    case "attack": {
      const enemies = facts.livingEnemies();
      const attacks = enemies.map((enemy) => ({
        enemy,
        outcomes: ordinaryAttackFacts(state, actor, def, value, enemy),
      }));
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
      if (def.target === "allEnemies")
        return [
          {
            kind: "attack",
            groups: attacks.map((attack) => attack.outcomes),
            aggregate: "sum",
            finish: winning,
            reason: winning
              ? "Attempt to finish every remaining enemy on ordinary hits"
              : "Damage enemies; give roster creatures priority over Minions",
          },
        ];
      if (def.target === "randomEnemy")
        return [
          {
            kind: "attack",
            groups: attacks.map((attack) => attack.outcomes),
            aggregate: "mean",
            finish: winning,
            reason: "Use the average visible benefit across random targets",
          },
        ];
      return attacks.map((attack) => {
        const { enemy } = attack;
        const finish = !actor.combat?.blind && remaining.length === 1 && !enemy.minion && lethal(attack);
        return {
          kind: "attack",
          groups: [attack.outcomes],
          aggregate: "sum",
          finish,
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
      if (def.target === "allAllies") {
        const benefits = allies.map((ally) => healingBenefit(state, ally, value, play.def.effects));
        const restored = benefits.reduce((sum, benefit) => sum + benefit.restored, 0);
        const utility = benefits.reduce((sum, benefit) => sum + benefit.utility, 0);
        if (restored > 0) return support("healing", restored);
        if (utility > 0) return support("utility", utility);
        if (
          def.effects?.some((effect) => effect.kind === "blind") &&
          state.battle.enemies.some((enemy) => enemy.health > 0 && !enemy.combat.blind)
        )
          return support("utility");
        return support(def.effects?.some((effect) => effect.kind === "draw") ? "standardUtility" : "none");
      }
      // Auto-play keeps its existing roster-recipient preference; manual play also permits summons.
      const recipients =
        def.target === "self" ? [actor] : def.target === "mostInjured" ? [mostInjured(allies)!] : allies;
      return recipients.flatMap((ally) => {
        const { restored, utility } = healingBenefit(state, ally, value, play.def.effects);
        return support(
          restored > 0 ? "healing" : utility > 0 ? "utility" : "none",
          restored > 0 ? restored : utility,
          def.target ? undefined : ally.id,
        );
      });
    }
    case "mana": {
      const cost = cardCost(card, state);
      const regained = Math.min(value, state.battle.maxMana - state.battle.mana + cost);
      const net = regained - cost;
      const mending = regained > 0 && hasTalent(state, "mana.arcane-mending") && facts.injuredAllies;
      return support(
        net > 0 ? "resource" : mending || facts.healingOnPlay ? "healing" : "none",
        net > 0 ? net : mending || facts.healingOnPlay ? regained : 0,
      );
    }
    case "teamClearBlind":
      return support("controlRemoval", allies.filter((unit) => unit.combat?.blind).length);
    case "teamThaw":
      return support("controlRemoval", allies.filter((unit) => (unit.combat?.freeze ?? 0) > 0).length);
    case "recover": {
      const useful = state.battle.discard.some((id) => {
        const card = state.cards.find((entry) => entry.id === id)!;
        return card.ownerId === null || drawableOwnerIds(state).has(card.ownerId);
      });
      if (def.target === "ally") {
        const healing =
          def.effects?.reduce(
            (sum, effect) =>
              sum + (effect.kind === "heal" && effect.target === "recipient" ? effect.amount : 0),
            0,
          ) ?? 0;
        return allies.flatMap((ally) => {
          const { restored, utility } = healingBenefit(state, ally, healing, play.def.effects);
          return support(
            restored > 0 ? "healing" : useful ? "standardUtility" : utility > 0 ? "utility" : "none",
            restored > 0 ? restored : utility,
            ally.id,
          );
        });
      }
      return support(useful ? "standardUtility" : "none");
    }
    case "teamDodge":
      return dodgeSupport(
        battlefield(state, "player")
          .filter((unit) => unit.health > 0)
          .reduce((sum, unit) => sum + Math.min(value, 70 - (unit.combat?.temporaryDodge ?? 0)), 0),
      );
    case "redraw":
      return support(state.battle.hand.length > 1 ? "redraw" : "none");
    case "draw":
      return support(healing > 0 ? "healing" : "standardUtility", healing > 0 ? healing : value);
    case "teamBlind": {
      const useful = facts
        .livingEnemies()
        .filter((enemy) => enemy.health > 0 && !enemy.combat.blind && !enemy.combat.nullify).length;
      return support(useful > 0 ? "utility" : "none", useful);
    }
    case "teamPurge": {
      const enemies = facts.livingEnemies();
      const useful = enemies.filter(
        (enemy) =>
          enemy.health > 0 &&
          (enemy.block > 0 ||
            enemy.combat.armor > 0 ||
            enemy.combat.thorns > 0 ||
            enemy.combat.waterThorns > 0 ||
            enemy.combat.dodge > 0 ||
            enemy.combat.temporaryDodge > 0 ||
            enemy.combat.reflect ||
            enemy.combat.reflectBurn ||
            enemy.combat.nullify ||
            enemy.combat.nullifyFreeze ||
            enemy.combat.negate ||
            enemy.combat.attackReflection),
      ).length;
      const defense = enemies.some(
        (enemy) => enemy.health > 0 && (enemy.block > 0 || enemy.combat.armor > 0),
      );
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
    case "dreamDouble":
      return support(actor.combat?.negate ? "protection" : "resource", value);
    case "nightmareHarvest": {
      const useful = battlefield(state, "player").filter(
        (unit) => unit.health > 0 && hasHarmfulEffects(unit),
      ).length;
      return support(useful > 0 ? "statusHarvest" : "none", useful);
    }
    case "teamCleanse":
      return support("utility");
    case "teamGuard":
    case "redistributeBlock":
    case "teamProtection": {
      const useful = allies.reduce(
        (sum, ally) =>
          sum +
          Math.min(value, STACK_LIMIT - ally.block) +
          (def.effect === "teamProtection" ? Math.min(value, STACK_LIMIT - (ally.combat?.thorns ?? 0)) : 0),
        0,
      );
      return support(useful > 0 ? "protection" : "none", useful);
    }
    case "nullify": {
      const useful = allies.filter((unit) => !unit.combat?.nullify).length;
      return support(useful > 0 ? "utility" : "none", useful);
    }
    case "waterThorns": {
      const useful = Math.min(value, STACK_LIMIT - (actor.combat?.waterThorns ?? 0));
      return support(useful > 0 ? "protection" : "none", useful);
    }
    case "dodge":
      return dodgeSupport(Math.min(value, 70 - (actor.combat?.temporaryDodge ?? 0)));
    case "swap":
    case "swapLowest":
      return support("utility");
    case "guard": {
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
      return (def.target === "self" ? [actor] : allies).flatMap((ally) => {
        const useful = Math.min(value, STACK_LIMIT - ally.block);
        return support(
          healing > 0 ? "healing" : useful + protection > 0 ? "protection" : "none",
          healing > 0 ? healing : useful + protection,
          def.target === "self" ? undefined : ally.id,
        );
      });
    }
    default: {
      const unhandled: never = def;
      throw new Error(`Unhandled battle benefit: ${unhandled}`);
    }
  }
}
