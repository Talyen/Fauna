import type { GameState } from "../../../game/types";
import { KeywordText } from "../keyword-text";
import { Droplet, Flame, FlaskConical, Leaf, Snowflake, Sun, Swords, Zap } from "lucide-react";
import { type CardDefinition, type DamageType } from "../../../game/content";
import { cardText, DAMAGE_LABELS } from "../../../game/card-rules";
const DAMAGE_ICONS = {
  physical: Swords,
  poison: FlaskConical,
  nature: Leaf,
  water: Droplet,
  light: Sun,
  burn: Flame,
  freeze: Snowflake,
  bleed: Swords,
  stun: Zap,
} as const;
export function DamageValue({
  type,
  amount,
  signed = false,
}: {
  type: DamageType;
  amount: number;
  signed?: boolean;
}) {
  const Icon = DAMAGE_ICONS[type];
  return (
    <span
      className="damage-value"
      data-damage-type={type}
      aria-label={`${amount} ${DAMAGE_LABELS[type]} damage`}
    >
      <Icon aria-hidden="true" />
      <span>
        {signed && amount > 0 ? "−" : ""}
        {amount}
      </span>
    </span>
  );
}
export function CardRules({
  card,
  level = 0,
  value,
  power = 1,
  modifiers,
}: {
  card: CardDefinition;
  level?: number;
  value?: number;
  power?: number;
  modifiers?: GameState;
}) {
  return (
    <span className="action-effect">
      <KeywordText text={cardText(card, level, value, power, modifiers)} />
    </span>
  );
}
