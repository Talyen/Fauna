import { pendingReplacement, formationForSwap } from "../game/team";
import { coverageScore, offenseValue } from "./team-policy";
import { battlefield } from "../game/battlefield";
import { hasTalent } from "../game/progression";
import { controlled, hasHarmfulEffects, mostInjured } from "../game/combat/index";
import { actionValue, cardCost, physicalBonus } from "../game/ability-rules";
import { definition, species } from "../game/content";
import type { Command, GameState } from "../game/types";

export const BATTLE_POLICY_VERSION = 29;
const BATTLE_FINISH_PRIORITY = 1_000_000_000;
export interface BattleChoice {
  command: Command;
  score: number;
  reason: string;
}
/** Only visible information enters scoring; no forecasts or gameplay RNG are sampled. */
export function rankedBattleChoices(state: GameState, autoEndTurn = true): BattleChoice[] {
  if (state.phase !== "battle") return [];
  const outgoing = pendingReplacement(state);
  if (outgoing) {
    const remaining = state.team.filter((unit) => unit.health > 0 && !controlled(unit));
    const needsDamage = !remaining.some((unit) => offenseValue(state, unit.species) > 0);
    const all = [...state.team, ...state.reserves];
    const active = state.team.map((unit) => unit.id);
    const incoming = [...state.reserves]
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((unit) => unit.health > 0)
      .map((unit) => {
        const ids = formationForSwap(all, active, outgoing.id, unit.id);
        const lineup = ids
          .map((id) => all.find((entry) => entry.id === id)!)
          .filter((entry) => entry.health > 0);
        const kinds = lineup.map((entry) => entry.species);
        const damage = needsDamage ? offenseValue(state, unit.species) : 0;
        const score =
          (damage > 0 ? 1_000_000 : 0) +
          (!controlled(unit) ? 100_000 : 0) +
          coverageScore(state, kinds) +
          damage * 100 +
          (unit.health / species(unit.species).health) * 100;
        return { unit, score };
      })
      .sort((a, b) => b.score - a.score)[0]?.unit;
    if (incoming)
      return [
        {
          command: {
            type: "swap",
            activeId: outgoing.id,
            reserve: incoming.id,
            ...(autoEndTurn ? {} : { autoEndTurn: false }),
          },
          score: BATTLE_FINISH_PRIORITY,
          reason:
            "Replace a knocked-out creature; restore missing deployed damage, then favor usable complementary backups",
        },
      ];
  }
  const options: (BattleChoice & { key: string })[] = [];
  const add = (cardId: string, score: number, targetId?: string, reason?: string) => {
    if (score > 0)
      options.push({
        command: { type: "play", cardId, targetId, autoEndTurn },
        score,
        reason:
          reason ??
          `Use ${definition(state.cards.find((card) => card.id === cardId)!.definitionId).name} for its visible benefit`,
        key: `${cardId}:${targetId ?? ""}`,
      });
  };
  for (const id of state.battle.hand) {
    const card = state.cards.find((c) => c.id === id)!;
    const actor = state.team.find((c) => c.id === card.ownerId);
    const def = definition(card.definitionId);
    if (!actor || actor.health === 0 || controlled(actor) || cardCost(card, state) > state.battle.mana)
      continue;
    const value = actionValue(card, actor, state);
    const healing = Math.min(
      species(actor.species).health - actor.health,
      def.effects?.reduce(
        (sum, effect) =>
          sum +
          (effect.kind === "heal"
            ? Math.round(effect.amount * (hasTalent(state, "health.mending") ? 1.1 : 1))
            : 0),
        0,
      ) ?? 0,
    );
    if (def.effect === "procession") {
      const echoes = (state.battle.minions ?? []).filter(
        (unit) => unit.minion.ownerId === actor.id && unit.health > 0,
      );
      add(id, echoes.length < 2 ? 1600 : echoes.some((unit) => unit.health < unit.maxHealth) ? 1200 : 100);
    } else if (def.effect === "createPearls" || def.effect === "pearl") {
      add(id, def.effect === "pearl" ? 500 : state.cards.length < 256 ? 400 : 0);
    } else if (def.effect === "attack") {
      const enemies = battlefield(state, "enemy").filter((e) => e.health > 0);
      const attacks = enemies.map((enemy) => {
        // Ordinary primary hits only; chance effects and hidden RNG are never forecast.
        const outcomes = [def.damageType, ...(def.alternateDamageType ? [def.alternateDamageType] : [])].map(
          (type) => {
            const damage =
              value * (def.doubleAgainstHealthier && enemy.health > actor.health ? 2 : 1) +
              (type === "physical" ? physicalBonus(actor, state) : 0);
            const armored = type === "physical" || type === "stun";
            const armor = armored
              ? Math.max(0, enemy.combat.armor - (state.boons.includes("sundering-charm") ? 2 : 0))
              : 0;
            const lost =
              enemy.combat.negate || (type === "freeze" && enemy.combat.nullifyFreeze)
                ? 0
                : Math.max(0, damage - enemy.block - armor);
            const blocked = enemy.combat.negate ? 0 : Math.min(damage, enemy.block);
            const eroded =
              !enemy.combat.negate && armored && state.boons.includes("sundering-charm")
                ? Math.min(2, enemy.combat.armor)
                : 0;
            const main = !enemy.minion;
            const lethal = lost >= enemy.health;
            const score = enemy.combat.negate
              ? main
                ? 400
                : 100
              : lost > 0
                ? (main ? 1000 : 250) + (lethal ? (main ? 1000 : 250) : 0) + Math.min(lost, enemy.health)
                : blocked > 0
                  ? (main ? 500 : 125) + blocked
                  : eroded > 0
                    ? 300 + eroded
                    : 0;
            // A blocked primary hit can still carry useful authored follow-up effects.
            const extra = def.effects?.some((effect) =>
              ["damage", "purge", "meltArmor", "blind", "draw", "mana", "status"].includes(effect.kind),
            )
              ? 200
              : 0;
            return { score: Math.max(score, extra), lethal };
          },
        );
        return {
          enemy,
          score: outcomes.reduce((sum, outcome) => sum + outcome.score, 0) / outcomes.length,
          lethal: outcomes.every((outcome) => outcome.lethal),
        };
      });
      const remaining = attacks.filter(({ enemy }) => !enemy.minion);
      const winning =
        !actor.combat?.blind &&
        remaining.length > 0 &&
        (def.target === "allEnemies"
          ? remaining.every((attack) => attack.lethal)
          : def.target === "randomEnemy"
            ? attacks.every(({ enemy, lethal }) => !enemy.minion && lethal) && remaining.length === 1
            : false);
      if (def.target === "allEnemies")
        add(
          id,
          (winning ? BATTLE_FINISH_PRIORITY : 0) + attacks.reduce((sum, attack) => sum + attack.score, 0),
          undefined,
          winning
            ? "Attempt to finish every remaining enemy on ordinary hits"
            : "Damage enemies; give roster creatures priority over Minions",
        );
      else if (def.target === "randomEnemy")
        add(
          id,
          (winning ? BATTLE_FINISH_PRIORITY : 0) +
            (attacks.length ? attacks.reduce((sum, attack) => sum + attack.score, 0) / attacks.length : 0),
          undefined,
          "Use the average visible benefit across random targets",
        );
      else
        for (const { enemy, lethal, score } of attacks) {
          const finish = !actor.combat?.blind && remaining.length === 1 && !enemy.minion && lethal;
          add(
            id,
            (finish ? BATTLE_FINISH_PRIORITY : 0) + score,
            enemy.id,
            finish
              ? "Attempt to finish the last enemy before healing or attacking Minions"
              : enemy.minion
                ? "Reduce a Minion threat"
                : "Make progress against an enemy creature",
          );
        }
    } else if (def.effect === "heal") {
      const allies = state.team.filter((c) => c.health > 0);
      const healingBenefit = (ally: (typeof allies)[number]) => {
        const missing = species(ally.species).health - ally.health;
        const amount = Math.round(value * (hasTalent(state, "health.mending") ? 1.1 : 1));
        const restored = Math.min(amount, missing);
        const excess = amount - restored;
        const overflow = hasTalent(state, "health.overflow")
          ? Math.min(Math.round(excess * 0.25), 1_000_000 - ally.block)
          : 0;
        const cleanses =
          hasHarmfulEffects(ally) &&
          ((excess > 0 && hasTalent(state, "health.clean-slate")) ||
            !!def.effects?.some((effect) => effect.kind === "cleanse" && effect.target === "recipient"));
        return { restored, utility: overflow + Number(cleanses) };
      };
      if (def.target === "allAllies") {
        const benefits = allies.map(healingBenefit);
        const restored = benefits.reduce((sum, benefit) => sum + benefit.restored, 0);
        const utility = benefits.reduce((sum, benefit) => sum + benefit.utility, 0);
        add(
          id,
          restored > 0
            ? 3000 + restored
            : utility > 0
              ? 150 + utility
              : def.effects?.some((effect) => effect.kind === "blind") &&
                  state.battle.enemies.some((enemy) => enemy.health > 0 && !enemy.combat.blind)
                ? 150
                : def.effects?.some((effect) => effect.kind === "draw")
                  ? 200
                  : 0,
        );
      } else
        for (const ally of def.target === "self"
          ? [actor]
          : def.target === "mostInjured"
            ? [mostInjured(allies)!]
            : allies) {
          const { restored, utility } = healingBenefit(ally);
          add(
            id,
            restored > 0 ? 3000 + restored : utility > 0 ? 150 + utility : 0,
            def.target ? undefined : ally.id,
          );
        }
    } else if (def.effect === "mana") {
      add(id, 400 + Math.min(value, state.battle.maxMana - state.battle.mana + cardCost(card, state)));
    } else if (def.effect === "teamClearBlind") {
      add(id, 200 + state.team.filter((unit) => unit.health > 0 && unit.combat?.blind).length * 100);
    } else if (def.effect === "teamThaw") {
      const useful = state.team.filter((unit) => unit.health > 0 && (unit.combat?.freeze ?? 0) > 0).length;
      add(id, 200 + useful * 100);
    } else if (def.effect === "recover") {
      const recoverable = state.battle.discard.some((discarded) => {
        const card = state.cards.find((card) => card.id === discarded)!;
        return state.team.some((unit) => unit.id === card.ownerId && unit.health > 0);
      });
      add(id, recoverable ? 200 : 0);
    } else if (def.effect === "teamDodge") {
      add(id, 150 + value);
    } else if (def.effect === "redraw") {
      add(id, state.battle.hand.length > 1 ? 190 : 0);
    } else if (def.effect === "draw") {
      add(id, healing > 0 ? 3000 + healing : 200 + value);
    } else if (def.effect === "teamBlind") {
      const useful = battlefield(state, "enemy").filter(
        (enemy) => enemy.health > 0 && !enemy.combat.blind && !enemy.combat.nullify,
      ).length;
      add(id, useful > 0 ? 150 + useful : 0);
    } else if (def.effect === "teamPurge") {
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
            enemy.combat.nullifyFreeze ||
            enemy.combat.negate),
      ).length;
      const defense = state.battle.enemies.some(
        (enemy) => enemy.health > 0 && (enemy.block > 0 || enemy.combat.armor > 0),
      );
      add(
        id,
        useful > 0 ? (defense ? 1700 : 160) + useful : 0,
        undefined,
        "Remove visible defenses before spending Mana on blocked attacks",
      );
    } else if (def.effect === "dreamDouble") {
      add(id, actor.combat?.negate ? 100 + value : 400 + value);
    } else if (def.effect === "nightmareHarvest") {
      const useful = battlefield(state, "player").filter(
        (unit) => unit.health > 0 && hasHarmfulEffects(unit),
      ).length;
      add(id, useful > 0 ? 2000 + useful : 0);
    } else if (def.effect === "teamCleanse") {
      add(id, 150);
    } else if (
      def.effect === "teamGuard" ||
      def.effect === "redistributeBlock" ||
      def.effect === "teamProtection"
    ) {
      const useful = state.team
        .filter((c) => c.health > 0)
        .reduce(
          (n, c) =>
            n +
            Math.min(value, 1_000_000 - c.block) +
            (def.effect === "teamProtection" ? Math.min(value, 1_000_000 - (c.combat?.thorns ?? 0)) : 0),
          0,
        );
      add(id, useful > 0 ? 100 + useful : 0);
    } else if (def.effect === "nullify") {
      const useful = state.team.filter((c) => c.health > 0 && !c.combat?.nullify).length;
      add(id, useful > 0 ? 150 + useful : 0);
    } else if (def.effect === "waterThorns") {
      const useful = Math.min(value, 1_000_000 - (actor.combat?.waterThorns ?? 0));
      add(id, useful > 0 ? 100 + useful : 0);
    } else if (def.effect === "dodge") {
      add(id, 150 + Math.max(0, value - (actor.combat?.temporaryDodge ?? 0)));
    } else if (def.effect === "swap" || def.effect === "swapLowest") {
      add(id, 150);
    } else {
      for (const ally of def.target === "self" ? [actor] : state.team.filter((c) => c.health > 0)) {
        const useful = Math.min(value, 1_000_000 - ally.block);
        add(
          id,
          healing > 0 ? 3000 + healing : useful > 0 ? 100 + useful : 0,
          def.target === "self" ? undefined : ally.id,
        );
      }
    }
  }
  return options
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .map(({ command, score, reason }) => ({ command, score, reason }));
}
export function battleChoices(state: GameState, autoEndTurn = true): Command[] {
  return rankedBattleChoices(state, autoEndTurn).map((choice) => choice.command);
}
export function chooseBattleCommand(state: GameState, autoEndTurn = true): Command {
  return rankedBattleChoices(state, autoEndTurn)[0]?.command ?? { type: "endTurn" };
}
