import { CombatStatus } from "./combat-status";
import { assetUrl } from "./assets";
import { useEffect, useState, type ReactNode } from "react";
import { BattleReadout } from "./target-preview";
import { ArtCard } from "./art-card";
import { ActionDetails, CreatureDetails } from "./card-details";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { actionValue, cardCost, physicalBonus } from "../game/rules";
import { cardText, definition, enemyCard, species } from "../game/content";
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
  combat?: import("../game/types").CombatState;
  speciesKit?: boolean;
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
  combat,
  speciesKit = false,
}: CreatureProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  useEffect(() => {
    if (!tooltips) setTooltipOpen(false);
  }, [tooltips]);
  const info = species(kind);
  const artwork = (
    <ArtCard
      aspect="creature"
      artwork={assetUrl(`creature.${kind}`)}
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
          (event.currentTarget.closest<HTMLElement>(".app")?.dataset.focus ??
            document.documentElement.dataset.focus) !== "visible"
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
          <TooltipContent side={enemyId ? "bottom" : "top"} sideOffset={enemyId && readout ? 44 : 16}>
            <CreatureDetails
              kind={kind}
              name={name}
              health={health}
              maxHealth={maxHealth}
              block={block}
              speciesKit={speciesKit}
              combat={combat}
            />
          </TooltipContent>
        </Tooltip>
      )}
      {preview ? (
        preview
      ) : readout && health !== undefined && (actorId || enemyId) ? (
        <BattleReadout health={health} maxHealth={maxHealth ?? info.health} block={block} />
      ) : null}
      {readout ? <CombatStatus combat={combat} /> : null}
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
      combat={creature.combat}
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
      block={enemy.block}
      combat={enemy.combat}
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
  enemy = false,
  enemyValue,
}: {
  card: Card;
  enemy?: boolean;
  enemyValue?: number;
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
  const def = enemy ? enemyCard(definition(card.definitionId)) : definition(card.definitionId);
  const artwork = (
    <ArtCard
      aspect="action"
      artwork={assetUrl(`action.${def.species}`)}
      presentation={presentation}
      tabIndex={presentation ? undefined : 0}
      className={selected ? "selected" : undefined}
      data-card-id={card.id}
      data-effect={def.effect}
      aria-label={
        label ??
        `${def.name}${card.level ? ` +${card.level}` : ""}, ${ownerName}, ${enemy ? "" : `${modifiers ? cardCost(card, modifiers) : def.cost} mana, `}${cardText(def, card.level, enemyValue ?? Math.round(actionValue(card, actor ?? { species: def.species, attacked: false }, modifiers) + (modifiers && actor && def.effect === "attack" && def.damageType === "physical" ? physicalBonus(actor, modifiers) : 0)))}`
      }
      aria-pressed={presentation ? undefined : selected}
      aria-disabled={presentation ? undefined : disabled}
      onFocus={(event) => {
        if (
          (event.currentTarget.closest<HTMLElement>(".app")?.dataset.focus ??
            document.documentElement.dataset.focus) !== "visible"
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
        <ActionDetails
          card={card}
          ownerName={ownerName}
          actor={actor}
          modifiers={modifiers}
          enemy={enemy}
          enemyValue={enemyValue}
        />
      </TooltipContent>
    </Tooltip>
  );
}
