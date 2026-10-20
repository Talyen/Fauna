import { useEffect, useState, type ReactNode } from "react";
import { BattleReadout } from "./target-preview";
import { ArtCard } from "./art-card";
import { ActionDetails, CreatureDetails } from "./card-details";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { actionValue } from "../game/rules";
import { cardText, definition, species } from "../game/content";
import type { SpeciesId } from "../game/content";
import type { Card, Creature, Enemy, GameState } from "../game/types";
type CreatureProps = {
  kind: SpeciesId;
  name?: string;
  health?: number;
  maxHealth?: number;
  block?: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: (element: HTMLElement) => void;
  onInspect?: () => void;
  label?: string;
  presentation?: boolean;
  enemyId?: string;
  actorId?: string;
  onPreview?: () => void;
  preview?: ReactNode;
  feedback?: ReactNode;
  tooltips?: boolean;
  readout?: boolean;
  invalidTarget?: boolean;
};
export function CreatureCard({
  kind,
  name,
  health,
  maxHealth,
  block = 0,
  selected = false,
  disabled = false,
  onClick,
  onInspect,
  label,
  presentation = false,
  enemyId,
  actorId,
  onPreview,
  preview,
  feedback,
  tooltips = true,
  readout = true,
  invalidTarget = false,
}: CreatureProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  useEffect(() => {
    if (!tooltips) setTooltipOpen(false);
  }, [tooltips]);
  const info = species(kind);
  const artwork = (
    <ArtCard
      aspect="creature"
      artwork={`./art/${kind}.svg`}
      presentation={presentation}
      className={[selected ? "selected" : "", invalidTarget ? "invalid-target" : ""].join(" ")}
      data-species={kind}
      data-enemy-id={enemyId}
      aria-label={label ?? info.name}
      aria-pressed={presentation ? undefined : selected}
      aria-disabled={presentation ? undefined : disabled}
      onClick={(event) => {
        setTooltipOpen(false);
        if (!disabled) onClick?.(event.currentTarget);
      }}
      onFocus={(event) => {
        if (
          (event.currentTarget.closest<HTMLElement>(".app")?.dataset.input ??
            document.documentElement.dataset.input) === "pointer"
        )
          event.preventDefault();
        else onPreview?.();
      }}
      onPointerEnter={onPreview}
      onContextMenu={
        onInspect
          ? (event) => {
              event.preventDefault();
              event.currentTarget.focus();
              onInspect();
            }
          : undefined
      }
    />
  );
  return (
    <div className={`creature-wrap ${health === 0 ? "knocked-out" : ""}`} data-actor-id={actorId ?? enemyId}>
      {presentation ? (
        artwork
      ) : (
        <Tooltip open={tooltips && tooltipOpen} onOpenChange={(open) => setTooltipOpen(tooltips && open)}>
          <TooltipTrigger asChild>{artwork}</TooltipTrigger>
          <TooltipContent side={enemyId ? "bottom" : "top"} sideOffset={enemyId && readout ? 44 : 8}>
            <CreatureDetails kind={kind} name={name} health={health} maxHealth={maxHealth} block={block} />
          </TooltipContent>
        </Tooltip>
      )}
      {preview ? (
        preview
      ) : readout && health !== undefined && (actorId || enemyId) ? (
        <BattleReadout health={health} maxHealth={maxHealth ?? info.health} block={block} />
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
      kind={creature.species}
      health={creature.health}
      block={creature.block}
      {...props}
    />
  );
}
export function EnemyCard({
  enemy,
  ...props
}: { enemy: Enemy } & Omit<CreatureProps, "kind" | "health" | "maxHealth" | "name">) {
  return (
    <CreatureCard
      kind={enemy.species}
      enemyId={enemy.id}
      name={enemy.name}
      health={enemy.health}
      maxHealth={enemy.maxHealth}
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
  modifiers,
  actor,
  tooltips = true,
  onDenied,
}: {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onInspect?: () => void;
  ownerName: string;
  presentation?: boolean;
  label?: string;
  modifiers?: GameState;
  actor?: Creature;
  tooltips?: boolean;
  onDenied?: (element: HTMLElement) => void;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  useEffect(() => {
    if (!tooltips) setTooltipOpen(false);
  }, [tooltips]);
  const def = definition(card.definitionId);
  const artwork = (
    <ArtCard
      aspect="action"
      artwork={`./art/${def.species}-action.svg`}
      presentation={presentation}
      tabIndex={presentation ? undefined : 0}
      className={selected ? "selected" : undefined}
      data-card-id={card.id}
      data-effect={def.effect}
      aria-label={
        label ??
        `${def.name}${card.level ? ` +${card.level}` : ""}, ${ownerName}, ${def.cost} mana, ${cardText(def, card.level, actionValue(card, actor ?? { species: def.species, attacked: false }, modifiers))}`
      }
      aria-pressed={presentation ? undefined : selected}
      aria-disabled={presentation ? undefined : disabled}
      onFocus={(event) => {
        if (
          (event.currentTarget.closest<HTMLElement>(".app")?.dataset.input ??
            document.documentElement.dataset.input) === "pointer"
        )
          event.preventDefault();
      }}
      onClick={(event) => {
        setTooltipOpen(false);
        if (disabled) onDenied?.(event.currentTarget);
        else onClick();
      }}
      onContextMenu={
        onInspect
          ? (event) => {
              event.preventDefault();
              event.currentTarget.focus();
              onInspect();
            }
          : undefined
      }
    />
  );
  return presentation ? (
    artwork
  ) : (
    <Tooltip open={tooltips && tooltipOpen} onOpenChange={(open) => setTooltipOpen(tooltips && open)}>
      <TooltipTrigger asChild>{artwork}</TooltipTrigger>
      <TooltipContent side="top">
        <ActionDetails card={card} ownerName={ownerName} actor={actor} modifiers={modifiers} />
      </TooltipContent>
    </Tooltip>
  );
}
