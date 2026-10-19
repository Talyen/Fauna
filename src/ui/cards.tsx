import type { ReactNode } from "react";
import { Heart, Shield, Crosshair } from "lucide-react";
import { Button } from "../components/ui/button";
import { CardRules } from "./combat-values";
import { motion } from "motion/react";
import { cardText, definition, species } from "../game/content";
import type { SpeciesId } from "../game/content";
import type { Card, Creature, Enemy } from "../game/types";
const MotionButton = motion.create(Button);
type CreatureProps = {
  kind: SpeciesId;
  name?: string;
  health?: number;
  maxHealth?: number;
  block?: number;
  marks?: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onInspect?: () => void;
  label?: string;
  intent?: ReactNode;
  presentation?: boolean;
  enemyId?: string;
};
export function CreatureCard({
  kind,
  name,
  health,
  maxHealth,
  block = 0,
  marks = 0,
  selected = false,
  disabled = false,
  onClick,
  onInspect,
  label,
  intent,
  presentation = false,
  enemyId,
}: CreatureProps) {
  const info = species(kind);
  const Component = presentation ? "div" : Button;
  return (
    <div className={`creature-wrap ${health === 0 ? "knocked-out" : ""}`}>
      {intent ? <div className="intent">{intent}</div> : null}
      <Component
        variant={presentation ? undefined : "art"}
        size={presentation ? undefined : "card"}
        className={`creature-card ${selected ? "selected" : ""}`}
        data-species={kind}
        data-enemy-id={enemyId}
        aria-label={label ?? info.name}
        aria-pressed={presentation ? undefined : selected}
        disabled={presentation ? undefined : disabled}
        onClick={onClick}
        onContextMenu={
          onInspect
            ? (event) => {
                event.preventDefault();
                onInspect();
              }
            : undefined
        }
      >
        <img src={`./art/${kind}.svg`} width="800" height="600" alt="" draggable={false} />
        <div className="creature-shade" />
        <div className="creature-caption">
          <strong className="creature-name">{name ?? info.name}</strong>
          {health !== undefined ? (
            <span className="health-number" aria-label={`${health} of ${maxHealth ?? info.health} health`}>
              <Heart aria-hidden="true" /> {health}/{maxHealth ?? info.health}
            </span>
          ) : null}
        </div>
        {health !== undefined ? (
          <span className="health-track" aria-hidden="true">
            <span style={{ width: `${(health / (maxHealth ?? info.health)) * 100}%` }} />
          </span>
        ) : null}
        {block > 0 ? (
          <span className="block-badge">
            <Shield aria-hidden="true" />
            {block} Block
          </span>
        ) : null}
        {marks > 0 ? (
          <span className="mark-badge">
            <Crosshair aria-hidden="true" />
            {marks} Marks
          </span>
        ) : null}
      </Component>
    </div>
  );
}
export function AllyCard({
  creature,
  ...props
}: { creature: Creature } & Omit<CreatureProps, "kind" | "health" | "block">) {
  return <CreatureCard kind={creature.species} health={creature.health} block={creature.block} {...props} />;
}
export function EnemyCard({
  enemy,
  intent,
  ...props
}: { enemy: Enemy; intent: ReactNode } & Omit<
  CreatureProps,
  "kind" | "health" | "maxHealth" | "marks" | "name" | "intent"
>) {
  return (
    <CreatureCard
      kind={enemy.species}
      enemyId={enemy.id}
      name={enemy.name}
      health={enemy.health}
      maxHealth={enemy.maxHealth}
      marks={enemy.marks}
      intent={enemy.health > 0 ? intent : undefined}
      {...props}
    />
  );
}
export function ActionCard({
  card,
  selected = false,
  disabled = false,
  onClick,
  onInspect,
  ownerName,
  presentation = false,
}: {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onInspect?: () => void;
  ownerName: string;
  presentation?: boolean;
}) {
  const def = definition(card.definitionId);
  const Component = presentation ? motion.div : MotionButton;
  return (
    <Component
      variant={presentation ? undefined : "art"}
      size={presentation ? undefined : "card"}
      tabIndex={presentation ? undefined : 0}
      layout
      className={`action-card ${selected ? "selected" : ""}`}
      data-card-id={card.id}
      data-effect={def.effect}
      aria-label={`${def.name}${card.level ? ` +${card.level}` : ""}, ${ownerName}, ${cardText(def, card.level)}`}
      aria-pressed={presentation ? undefined : selected}
      aria-disabled={presentation ? undefined : disabled}
      onClick={onClick}
      onContextMenu={
        onInspect
          ? (event) => {
              event.preventDefault();
              onInspect();
            }
          : undefined
      }
      whileHover={presentation ? undefined : { y: -8 }}
      whileFocus={presentation ? undefined : { y: -8 }}
    >
      <img src={`./art/${def.species}-action.svg`} width="600" height="800" alt="" draggable={false} />
      <div className="action-shade" />
      <span className="energy-cost" aria-label={`${def.cost} energy`}>
        {def.cost}
      </span>
      <div className="action-copy">
        <strong>
          {def.name}
          {card.level ? ` +${card.level}` : ""}
        </strong>
        <CardRules card={def} level={card.level} />
      </div>
    </Component>
  );
}
