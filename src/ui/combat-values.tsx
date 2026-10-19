import { Flame, FlaskConical, Leaf, Snowflake, Sun, Swords, Zap } from "lucide-react";
import { cardText, DAMAGE_LABELS, type CardDefinition, type DamageType } from "../game/content";
const DAMAGE_ICONS = {
  physical: Swords,
  fire: Flame,
  ice: Snowflake,
  lightning: Zap,
  poison: FlaskConical,
  nature: Leaf,
  light: Sun,
} as const;
export function DamageValue({ type, amount }: { type: DamageType; amount: number }) {
  const Icon = DAMAGE_ICONS[type];
  return (
    <span
      className="damage-value"
      data-damage-type={type}
      aria-label={`${amount} ${DAMAGE_LABELS[type]} damage`}
    >
      <Icon aria-hidden="true" />
      <span>{amount}</span>
    </span>
  );
}
export function CardRules({ card, level = 0 }: { card: CardDefinition; level?: number }) {
  const text = cardText(card, level),
    period = text.indexOf(".");
  const tone =
    card.effect === "attack"
      ? card.damageType
      : card.effect === "heal"
        ? "health"
        : card.effect === "guard" || card.effect === "teamGuard"
          ? "block"
          : undefined;
  return (
    <span className="action-effect">
      <span data-combat-tone={tone}>{period < 0 ? text : text.slice(0, period + 1)}</span>
      {period < 0 ? "" : text.slice(period + 1)}
    </span>
  );
}
