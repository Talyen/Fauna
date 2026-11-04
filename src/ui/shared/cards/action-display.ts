import { projectPlay } from "../../../game/preview";
import { chosenRecipients } from "../../../game/play-queries";
import { actionValue, physicalBonus } from "../../../game/ability-rules";
import { definition, type CardDefinition } from "../../../game/content";
import type { Card, Creature, GameState } from "../../../game/types";

/** Resolve the same rules for artwork labels, tooltips, and target selection. */
export function actionDisplay(
  card: Card,
  actor: Creature | undefined,
  modifiers: GameState | undefined,
  def: CardDefinition = definition(card.definitionId),
) {
  const value = Math.round(
    actionValue(card, actor ?? { species: def.species, attacked: false }, modifiers, def) +
      (modifiers && actor && def.effect === "attack" && def.damageType === "physical"
        ? physicalBonus(actor, modifiers)
        : 0),
  );
  return { def, value };
}

const offensiveCache = new WeakMap<GameState, Map<string, number | undefined>>();
/** Only replace the primary magnitude when every legal recipient and complete alternative agrees. */
export function offensiveCardValue(card: Card, actor: Creature | undefined, game: GameState | undefined) {
  if (!game || game.phase !== "battle" || !actor) return undefined;
  const def = definition(card.definitionId);
  if (def.effect !== "attack") return undefined;
  let cache = offensiveCache.get(game);
  if (!cache) {
    cache = new Map();
    offensiveCache.set(game, cache);
  }
  if (cache.has(card.id)) return cache.get(card.id);
  const recipients = chosenRecipients(game, def, actor);
  const targets: (string | undefined)[] = recipients.length ? recipients.map((unit) => unit.id) : [undefined];
  let agreed: number | undefined;
  for (const target of targets) {
    const projection = projectPlay(game, card.id, target);
    if (projection.kind !== "complete" || projection.outcomes.some((outcome) => !outcome.accepted)) {
      cache.set(card.id, undefined);
      return undefined;
    }
    for (const packets of projection.offensive ?? []) {
      const primary = packets.filter(
        (packet) => packet.primary && packet.sourceId === actor.id && packet.damageType === def.damageType,
      );
      // A dodged/negated alternative has no offensive packet; it does not change the hit magnitude.
      if (!primary.length) continue;
      for (const packet of primary) {
        if (agreed !== undefined && agreed !== packet.amount) {
          cache.set(card.id, undefined);
          return undefined;
        }
        agreed = packet.amount;
      }
    }
  }
  cache.set(card.id, agreed);
  return agreed;
}
