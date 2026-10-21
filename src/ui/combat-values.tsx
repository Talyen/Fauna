import { KeywordText } from "./keyword-text";
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
  burn: Flame,
  freeze: Snowflake,
  bleed: Swords,
  stun: Zap,
} as const;
export function DamageValue({
  type,
  amount,
  signed = false,
  reservedDigits,
}: {
  type: DamageType;
  amount: number;
  signed?: boolean;
  reservedDigits?: number;
}) {
  const Icon = DAMAGE_ICONS[type];
  return (
    <span
      className="damage-value"
      data-damage-type={type}
      aria-label={`${amount} ${DAMAGE_LABELS[type]} damage`}
    >
      <Icon aria-hidden="true" />
      <span
        style={{
          width: reservedDigits ? `${reservedDigits + (signed && amount !== 0 ? 1 : 0)}ch` : undefined,
        }}
      >
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
}: {
  card: CardDefinition;
  level?: number;
  value?: number;
}) {
  return (
    <span className="action-effect">
      <KeywordText text={cardText(card, level, value)} />
    </span>
  );
}
