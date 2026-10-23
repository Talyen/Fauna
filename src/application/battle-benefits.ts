import { battlefield } from "../game/battlefield";
import { hasTalent } from "../game/progression";
import { hasHarmfulEffects, mostInjured } from "../game/combat/state";
import { actionValue, cardCost, physicalBonus } from "../game/ability-rules";
import { armoredDamage, blockPayment } from "../game/combat/damage-values";
import { healingValue, restoration, overflowBlock } from "../game/combat/healing-values";
import type { AvailablePlay } from "../game/play-queries";
import type { BattleState, Creature } from "../game/types";

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
  | "redraw"
  | "defensePurge"
  | "purge";
export interface OrdinaryHit {
  readonly lost: number;
  readonly blocked: number;
  readonly eroded: number;
  readonly health: number;
  readonly main: boolean;
  readonly lethal: boolean;
  readonly usefulExtras: boolean;
}
export type BattleBenefit = { targetId?: string; reason?: string } & (
  | { kind: "attack"; groups: OrdinaryHit[][]; aggregate: "sum" | "mean"; finish: boolean }
  | { kind: "support"; priority: SupportPriority; amount: number }
);

function healBenefit(state: BattleState, ally: Creature, value: number, play: AvailablePlay) {
  const { gain, excess } = restoration(ally, healingValue(state, ally, value));
  const overflow = hasTalent(state, "health.overflow")
    ? Math.min(overflowBlock(excess), 1_000_000 - ally.block)
    : 0;
  const cleanses =
    hasHarmfulEffects(ally) &&
    ((excess > 0 && hasTalent(state, "health.clean-slate")) ||
      !!play.def.effects?.some((effect) => effect.kind === "cleanse" && effect.target === "recipient"));
  return { restored: gain, utility: overflow + Number(cleanses) };
}

/** Visible facts and explicit approximations; ranking weights live with the application policy. */
export function battleBenefits(state: BattleState, play: AvailablePlay): BattleBenefit[] {
  const { card, actor, def } = play;
  const value = actionValue(card, actor, state);
  const healing = restoration(
    actor,
    def.effects?.reduce(
      (sum, effect) =>
        sum +
        (effect.kind === "heal" ? restoration(actor, healingValue(state, actor, effect.amount)).rounded : 0),
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
    case "createPearls":
      return support(state.cards.length < 256 ? "resource" : "none");
    case "pearl":
      return support("pearl");
    case "attack": {
      const enemies = battlefield(state, "enemy").filter((unit) => unit.health > 0);
      const outcomes = (enemy: (typeof enemies)[number]): OrdinaryHit[] =>
        [def.damageType, ...(def.alternateDamageType ? [def.alternateDamageType] : [])].map((type) => {
          // Ordinary primary packets omit chance effects and most talent reactions deliberately.
          const damage =
            value * (def.doubleAgainstHealthier && enemy.health > actor.health ? 2 : 1) +
            (type === "physical" ? physicalBonus(actor, state) : 0);
          const armored = type === "physical" || type === "stun";
          const armor = armored
            ? Math.max(0, enemy.combat.armor - (state.boons.includes("sundering-charm") ? 2 : 0))
            : 0;
          const payment = blockPayment(damage, enemy.block);
          const lost =
            type === "freeze" && enemy.combat.nullifyFreeze ? 0 : armoredDamage(payment.remaining, armor);
          const eroded =
            armored && state.boons.includes("sundering-charm") ? Math.min(2, enemy.combat.armor) : 0;
          return {
            lost,
            blocked: payment.absorbed,
            eroded,
            health: enemy.health,
            main: !enemy.minion,
            lethal: lost >= enemy.health,
            usefulExtras: !!def.effects?.some((effect) =>
              ["damage", "purge", "meltArmor", "blind", "draw", "mana", "status"].includes(effect.kind),
            ),
          };
        });
      const attacks = enemies.map((enemy) => ({ enemy, outcomes: outcomes(enemy) }));
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
        const benefits = allies.map((ally) => healBenefit(state, ally, value, play));
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
        const { restored, utility } = healBenefit(state, ally, value, play);
        return support(
          restored > 0 ? "healing" : utility > 0 ? "utility" : "none",
          restored > 0 ? restored : utility,
          def.target ? undefined : ally.id,
        );
      });
    }
    case "mana":
      return support(
        "resource",
        Math.min(value, state.battle.maxMana - state.battle.mana + cardCost(card, state)),
      );
    case "teamClearBlind":
      return support("standardUtility", allies.filter((unit) => unit.combat?.blind).length * 100);
    case "teamThaw":
      return support("standardUtility", allies.filter((unit) => (unit.combat?.freeze ?? 0) > 0).length * 100);
    case "recover": {
      const useful = state.battle.discard.some((id) => {
        const card = state.cards.find((entry) => entry.id === id)!;
        return allies.some((unit) => unit.id === card.ownerId);
      });
      return support(useful ? "standardUtility" : "none");
    }
    case "teamDodge":
      return support("utility", value);
    case "redraw":
      return support(state.battle.hand.length > 1 ? "redraw" : "none");
    case "draw":
      return support(healing > 0 ? "healing" : "standardUtility", healing > 0 ? healing : value);
    case "teamBlind": {
      const useful = battlefield(state, "enemy").filter(
        (enemy) => enemy.health > 0 && !enemy.combat.blind && !enemy.combat.nullify,
      ).length;
      return support(useful > 0 ? "utility" : "none", useful);
    }
    case "teamPurge": {
      const useful = state.battle.enemies.filter(
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
            enemy.combat.nullifyFreeze),
      ).length;
      const defense = state.battle.enemies.some(
        (enemy) => enemy.health > 0 && (enemy.block > 0 || enemy.combat.armor > 0),
      );
      return support(
        useful > 0 ? (defense ? "defensePurge" : "purge") : "none",
        useful,
        undefined,
        "Remove visible defenses before spending Mana on blocked attacks",
      );
    }
    case "teamCleanse":
      return support("utility");
    case "teamGuard":
    case "redistributeBlock":
    case "teamProtection": {
      const useful = allies.reduce(
        (sum, ally) =>
          sum +
          Math.min(value, 1_000_000 - ally.block) +
          (def.effect === "teamProtection" ? Math.min(value, 1_000_000 - (ally.combat?.thorns ?? 0)) : 0),
        0,
      );
      return support(useful > 0 ? "protection" : "none", useful);
    }
    case "nullify": {
      const useful = allies.filter((unit) => !unit.combat?.nullify).length;
      return support(useful > 0 ? "utility" : "none", useful);
    }
    case "waterThorns": {
      const useful = Math.min(value, 1_000_000 - (actor.combat?.waterThorns ?? 0));
      return support(useful > 0 ? "protection" : "none", useful);
    }
    case "dodge":
      return support("utility", Math.max(0, value - (actor.combat?.temporaryDodge ?? 0)));
    case "swap":
    case "swapLowest":
      return support("utility");
    case "guard":
      return (def.target === "self" ? [actor] : allies).flatMap((ally) => {
        const useful = Math.min(value, 1_000_000 - ally.block);
        return support(
          healing > 0 ? "healing" : useful > 0 ? "protection" : "none",
          healing > 0 ? healing : useful,
          def.target === "self" ? undefined : ally.id,
        );
      });
    default: {
      const unhandled: never = def;
      throw new Error(`Unhandled battle benefit: ${unhandled}`);
    }
  }
}
