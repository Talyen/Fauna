import { useState, type ReactNode } from "react";
import { Heart, Shield, Crosshair } from "lucide-react";
import { Button } from "../components/ui/button";
import { ActionDetails, CreatureDetails } from "./card-details";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { actionValue } from "../game/rules";
import { cardText, definition, species } from "../game/content";
import type { SpeciesId } from "../game/content";
import type { Card, Creature, Enemy } from "../game/types";
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
  actorId?: string;
  onPreview?: () => void;
  preview?: ReactNode;
  feedback?: ReactNode;
  cards?: readonly Card[];
  actor?: Creature;
  tooltips?: boolean;
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
  actorId,
  onPreview,
  preview,
  feedback,
  cards,
  actor,
  tooltips = true,
}: CreatureProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const info = species(kind);
  const Component = presentation ? "div" : Button;
  const artwork = (
    <Component
      variant={presentation ? undefined : "art"}
      size={presentation ? undefined : "card"}
      className={`creature-card ${selected ? "selected" : ""}`}
      data-species={kind}
      data-enemy-id={enemyId}
      aria-label={label ?? info.name}
      aria-pressed={presentation ? undefined : selected}
      aria-disabled={presentation ? undefined : disabled}
      onClick={() => {
        setTooltipOpen(false);
        if (!disabled) onClick?.();
      }}
      onFocus={onPreview}
      onPointerEnter={onPreview}
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
    </Component>
  );
  return (
    <div className={`creature-wrap ${health === 0 ? "knocked-out" : ""}`} data-actor-id={actorId ?? enemyId}>
      {intent ? <div className="intent">{intent}</div> : null}
      {presentation ? (
        artwork
      ) : (
        <Tooltip open={tooltips && tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>{artwork}</TooltipTrigger>
          <TooltipContent>
            <CreatureDetails
              kind={kind}
              name={name}
              health={health}
              maxHealth={maxHealth}
              block={block}
              marks={marks}
              cards={cards}
              actor={actor}
            />
            {intent ? <p>{intent}</p> : null}
          </TooltipContent>
        </Tooltip>
      )}
      {preview ? (
        preview
      ) : health !== undefined && (actorId || enemyId) ? (
        <div className="creature-readout">
          <span className="health-number" aria-label={`${health} of ${maxHealth ?? info.health} health`}>
            <Heart aria-hidden="true" />
            {health}/{maxHealth ?? info.health}
          </span>
          {block > 0 ? (
            <span className="block-badge" aria-label={`${block} block`}>
              <Shield aria-hidden="true" />
              {block}
            </span>
          ) : null}
          {marks > 0 ? (
            <span className="mark-badge" aria-label={`${marks} marks`}>
              <Crosshair aria-hidden="true" />
              {marks}
            </span>
          ) : null}
        </div>
      ) : null}
      {feedback}
    </div>
  );
}

export function AllyCard({
  creature,
  ...props
}: { creature: Creature } & Omit<CreatureProps, "kind" | "health" | "block">) {
  return (
    <CreatureCard
      actorId={creature.id}
      actor={creature}
      kind={creature.species}
      health={creature.health}
      block={creature.block}
      {...props}
    />
  );
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
  label,
  upgrade = false,
  actor,
  tooltips = true,
}: {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onInspect?: () => void;
  ownerName: string;
  presentation?: boolean;
  label?: string;
  upgrade?: boolean;
  actor?: Creature;
  tooltips?: boolean;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const def = definition(card.definitionId);
  const Component = presentation ? "div" : Button;
  const artwork = (
    <Component
      variant={presentation ? undefined : "art"}
      size={presentation ? undefined : "card"}
      tabIndex={presentation ? undefined : 0}
      className={`action-card ${selected ? "selected" : ""}`}
      data-card-id={card.id}
      data-effect={def.effect}
      aria-label={
        label ??
        `${def.name}${card.level ? ` +${card.level}` : ""}, ${ownerName}, ${def.cost} energy, ${cardText(def, card.level, actionValue(card, actor ?? { species: def.species, attacked: false }))}`
      }
      aria-pressed={presentation ? undefined : selected}
      aria-disabled={presentation ? undefined : disabled}
      onClick={() => {
        setTooltipOpen(false);
        onClick();
      }}
      onContextMenu={
        onInspect
          ? (event) => {
              event.preventDefault();
              onInspect();
            }
          : undefined
      }
    >
      <img src={`./art/${def.species}-action.svg`} width="600" height="800" alt="" draggable={false} />
    </Component>
  );
  return presentation ? (
    artwork
  ) : (
    <Tooltip open={tooltips && tooltipOpen} onOpenChange={setTooltipOpen}>
      <TooltipTrigger asChild>{artwork}</TooltipTrigger>
      <TooltipContent>
        <ActionDetails card={card} ownerName={ownerName} actor={actor} />
        {upgrade ? (
          card.level >= 3 ? (
            <p>Maximum upgrade.</p>
          ) : (
            <>
              <p>After upgrade:</p>
              <ActionDetails card={{ ...card, level: card.level + 1 }} ownerName={ownerName} actor={actor} />
            </>
          )
        ) : disabled ? (
          <p>Not enough energy.</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
