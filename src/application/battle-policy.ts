import { battlefield } from "../game/battlefield";
import { hasTalent } from "../game/progression";
import { controlled, hasHarmfulEffects, mostInjured } from "../game/combat/index";
import { actionValue, cardCost, physicalBonus } from "../game/ability-rules";
import { definition, species } from "../game/content";
import type { Command, GameState } from "../game/types";

export const BATTLE_POLICY_VERSION = 20;
/** Only visible information enters scoring; no forecasts or gameplay RNG are sampled. */
export function battleChoices(state: GameState, autoEndTurn = true): Command[] {
  if (state.phase !== "battle") return [];
  const order = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
  const outgoing = order(state.team).find((c) => c.health === 0 || controlled(c));
  const incoming = order(state.reserves).find((c) => c.health > 0 && !controlled(c));
  // A replacement is actionable; it cannot itself be selected as the next recovery swap.
  if (outgoing && incoming) return [{ type: "swap", activeId: outgoing.id, reserve: incoming.id }];
  if (
    !outgoing &&
    incoming &&
    state.team.length < 3 &&
    !state.team.some((unit) => species(unit.species).legendary) &&
    !species(incoming.species).legendary
  )
    return [{ type: "swap", activeId: "", reserve: incoming.id }];
  const options: { command: Command; score: number; key: string }[] = [];
  const add = (cardId: string, score: number, targetId?: string) => {
    if (score > 0)
      options.push({
        command: { type: "play", cardId, targetId, autoEndTurn },
        score,
        key: `${cardId}:${targetId ?? ""}`,
      });
  };
  for (const id of state.battle.hand) {
    const card = state.cards.find((c) => c.id === id)!;
    const actor = state.team.find((c) => c.id === card.ownerId);
    const def = definition(card.definitionId);
    if (!actor || actor.health === 0 || controlled(actor) || cardCost(card, state) > state.battle.mana)
      continue;
    const value =
      actionValue(card, actor, state) +
      (def.effect === "attack" && def.damageType === "physical" ? physicalBonus(actor, state) : 0);
    if (def.effect === "procession") {
      const echoes = (state.battle.minions ?? []).filter(
        (unit) => unit.minion.ownerId === actor.id && unit.health > 0,
      );
      add(id, echoes.length < 2 ? 1600 : echoes.some((unit) => unit.health < unit.maxHealth) ? 1200 : 100);
    } else if (def.effect === "createPearls" || def.effect === "pearl") {
      add(id, def.effect === "pearl" ? 500 : state.cards.length < 256 ? 400 : 0);
    } else if (def.effect === "attack") {
      const enemies = battlefield(state, "enemy").filter((e) => e.health > 0);
      const score = (enemy: (typeof enemies)[number]) => {
        const physical = def.damageType === "physical" || def.damageType === "stun";
        // Rank ordinary landed hits; do not roll Dodge or Critical outcomes.
        const effective = Math.max(0, value - enemy.block - (physical ? enemy.combat.armor : 0));
        return (effective >= enemy.health ? 2000 : 1000) + Math.min(value, enemy.health);
      };
      if (def.target === "allEnemies")
        add(
          id,
          enemies.reduce((sum, enemy) => sum + score(enemy), 0),
        );
      else if (def.target === "randomEnemy")
        add(id, enemies.length ? enemies.reduce((sum, enemy) => sum + score(enemy), 0) / enemies.length : 0);
      else for (const enemy of enemies) add(id, score(enemy), enemy.id);
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
      add(id, 200 + value);
    } else if (def.effect === "teamBlind") {
      const useful = state.battle.enemies.filter(
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
            enemy.combat.nullifyFreeze),
      ).length;
      add(id, useful > 0 ? 160 + useful : 0);
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
      add(id, 100 + value);
    } else if (def.effect === "dodge") {
      add(id, 150 + Math.max(0, value - (actor.combat?.temporaryDodge ?? 0)));
    } else if (def.effect === "swap") {
      add(id, 150);
    } else {
      for (const ally of def.target === "self" ? [actor] : state.team.filter((c) => c.health > 0)) {
        const useful = Math.min(value, 1_000_000 - ally.block);
        add(id, useful > 0 ? 100 + useful : 0, def.target === "self" ? undefined : ally.id);
      }
    }
  }
  return options.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)).map((o) => o.command);
}
export function chooseBattleCommand(state: GameState, autoEndTurn = true): Command {
  return battleChoices(state, autoEndTurn)[0] ?? { type: "endTurn" };
}
