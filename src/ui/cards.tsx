import { motion } from "motion/react";
import { cardText, definition, species } from "../game/content";
import type { SpeciesId } from "../game/content";
import type { Card, Creature, Enemy } from "../game/types";
export function CreatureCard({
  kind,
  name,
  health,
  maxHealth,
  block = 0,
  selected = false,
  disabled = false,
  onClick,
  label,
  intent,
  marks = 0,
  tag,
}: {
  kind: SpeciesId;
  name?: string;
  health?: number;
  maxHealth?: number;
  block?: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
  intent?: string;
  marks?: number;
  tag?: string;
}) {
  const info = species(kind);
  return (
    <div className={`creature-wrap ${health === 0 ? "knocked-out" : ""}`}>
      {intent ? (
        <div className="intent">
          <span aria-hidden="true">↘</span> {intent}
        </div>
      ) : null}
      <button
        className={`creature-card ${selected ? "selected" : ""}`}
        style={{ "--creature-color": info.color } as React.CSSProperties}
        aria-label={label ?? info.name}
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
      >
        <img src={`./art/${kind}.svg`} width="800" height="600" alt="" draggable={false} />
        <div className="creature-shade" />
        <span className="species-tag">{tag ?? info.trait}</span>
        <div className="creature-caption">
          <span className="creature-name">{name ?? info.name}</span>
          {health !== undefined ? (
            <span className="health-number">
              {health}
              <small> / {maxHealth ?? info.health}</small> <span aria-hidden="true">♥</span>
            </span>
          ) : (
            <span className="creature-title">{info.title}</span>
          )}
        </div>
        {health !== undefined ? (
          <span className="health-track">
            <span style={{ width: `${(health / (maxHealth ?? info.health)) * 100}%` }} />
          </span>
        ) : null}
        {block > 0 ? <span className="block-badge">◇ {block} block</span> : null}
        {marks > 0 ? <span className="mark-badge">✦ {marks} marks</span> : null}
        {selected ? <span className="selected-badge">✓</span> : null}
      </button>
    </div>
  );
}
export function AllyCard({
  creature,
  ...props
}: {
  creature: Creature;
  selected?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return <CreatureCard kind={creature.species} health={creature.health} block={creature.block} {...props} />;
}
export function EnemyCard({
  enemy,
  intent,
  ...props
}: {
  enemy: Enemy;
  intent: string;
  selected?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <CreatureCard
      kind={enemy.species}
      tag="WILD"
      name={enemy.name}
      health={enemy.health}
      maxHealth={enemy.maxHealth}
      marks={enemy.marks}
      intent={enemy.health > 0 ? intent : "Defeated"}
      {...props}
    />
  );
}
export function ActionCard({
  card,
  selected = false,
  disabled = false,
  onClick,
  ownerName,
  presentation = false,
}: {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  ownerName: string;
  presentation?: boolean;
}) {
  const def = definition(card.definitionId),
    info = species(def.species);
  return (
    <motion.button
      tabIndex={presentation ? -1 : 0}
      aria-hidden={presentation || undefined}
      layout
      className={`action-card ${selected ? "selected" : ""}`}
      data-card-id={card.id}
      aria-label={`${def.name}${card.level ? ` +${card.level}` : ""}, ${ownerName}, ${cardText(def, card.level)}`}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={onClick}
      whileHover={{ y: -12 }}
      whileFocus={{ y: -12 }}
      style={{ "--creature-color": info.color } as React.CSSProperties}
    >
      <img src={`./art/${def.species}-action.svg`} width="600" height="800" alt="" draggable={false} />
      <div className="action-shade" />
      <span className="energy-cost">{def.cost}</span>
      <span className="action-type">
        {def.effect === "teamGuard" ? "TEAM GUARD" : def.effect.toUpperCase()}
      </span>
      <div className="action-copy">
        <span className="action-owner">{ownerName}</span>
        <strong>
          {def.name}
          {card.level ? ` +${card.level}` : ""}
        </strong>
        <span className="action-effect">{cardText(def, card.level)}</span>
      </div>
    </motion.button>
  );
}
