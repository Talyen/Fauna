import { CombatStatus } from "../combat/combat-status";
import { assetUrl } from "../assets";
import { useState, type ComponentProps, type ReactNode } from "react";
import { BattleReadout } from "../combat/battle-readout";
import { ArtCard } from "./art-card";
import { ActionDetails, CreatureDetails } from "./card-details";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip";
import { actionValue, cardCost, physicalBonus } from "../../../game/ability-rules";
import { definition, species } from "../../../game/content";
import { cardText, enemyCard } from "../../../game/card-rules";
import type { SpeciesId } from "../../../game/content";
import type { Card, Creature, Enemy, GameState } from "../../../game/types";
type CreatureProps = {
  progression?: Pick<GameState, "discovery">;
  kind: SpeciesId;
  artworkId?: string;
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
  onPreviewEnd?: () => void;
  validTarget?: boolean;
  activeTarget?: boolean;
  acting?: boolean;
  preview?: ReactNode;
  tooltips?: boolean;
  tooltipContent?: ReactNode;
  tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
  readout?: boolean;
  invalidTarget?: boolean;
  combat?: import("../../../game/types").CombatState;
  speciesKit?: boolean;
  sharedDodge?: number;
};
function useCardTooltip(enabled: boolean) {
  const [state, setState] = useState({ enabled, open: false });
  if (state.enabled !== enabled) setState({ enabled, open: false });
  return [enabled && state.open, (open: boolean) => setState({ enabled, open: enabled && open })] as const;
}

export function CreatureCard({
  progression,
  kind,
  artworkId,
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
  onPreviewEnd,
  validTarget = false,
  activeTarget = false,
  acting = false,
  preview,
  tooltips = true,
  tooltipContent,
  tooltipSide = "top",
  readout = true,
  invalidTarget = false,
  combat,
  speciesKit = false,
  sharedDodge = 0,
}: CreatureProps) {
  const [tooltipOpen, setTooltipOpen] = useCardTooltip(tooltips);
  const info = species(kind);
  const artwork = (
    <ArtCard
      aspect="creature"
      artwork={assetUrl(artworkId ?? `creature.${kind}`)}
      control={health === 0 ? null : combat?.controlled}
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
      onPointerMove={onPreview}
      onPointerLeave={onPreviewEnd}
      onBlur={onPreviewEnd}
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
    <div
      className={`creature-wrap ${health === 0 ? "knocked-out" : ""}`}
      data-actor-id={actorId ?? enemyId}
      data-valid-target={validTarget || undefined}
      data-active-target={activeTarget || undefined}
      data-acting={acting || undefined}
      data-max-health={maxHealth ?? info.health}
    >
      <div className="combatant-motion">
        <div className="combatant-reaction">
          {presentation ? (
            artwork
          ) : (
            <Tooltip open={tooltips && tooltipOpen} onOpenChange={(open) => setTooltipOpen(tooltips && open)}>
              <TooltipTrigger asChild>{artwork}</TooltipTrigger>
              <TooltipContent side={tooltipSide}>
                {tooltipContent ?? (
                  <CreatureDetails
                    progression={progression}
                    kind={kind}
                    name={name}
                    block={block}
                    speciesKit={speciesKit}
                    combat={combat}
                    sharedDodge={sharedDodge}
                  />
                )}
              </TooltipContent>
            </Tooltip>
          )}
          <div className="combatant-details">
            {preview ? (
              preview
            ) : readout && health !== undefined && (actorId || enemyId) ? (
              <BattleReadout health={health} maxHealth={maxHealth ?? info.health} block={block} />
            ) : null}
            {readout ? <CombatStatus combat={combat} sharedDodge={sharedDodge} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AllyCard({
  creature,
  ...props
}: { creature: Creature | Enemy } & Omit<CreatureProps, "kind" | "health" | "block">) {
  return (
    <CreatureCard
      actorId={creature.id}
      artworkId={"minion" in creature && creature.minion ? "minion.echo" : undefined}
      name={"name" in creature ? creature.name : undefined}
      maxHealth={"maxHealth" in creature ? creature.maxHealth : undefined}
      tooltipContent={
        "minion" in creature && creature.minion ? (
          <div className="card-details">
            <strong>Echo · Minion</strong>
            <p>Attacks through The Court Remembers</p>
          </div>
        ) : undefined
      }
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
      artworkId={enemy.minion ? "minion.echo" : undefined}
      tooltipContent={
        enemy.minion ? (
          <div className="card-details">
            <strong>Echo · Minion</strong>
            <p>Attacks through The Court Remembers</p>
          </div>
        ) : undefined
      }
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
  enemyPower = 1,
}: {
  card: Card;
  enemy?: boolean;
  enemyValue?: number;
  enemyPower?: number;
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
  const [tooltipOpen, setTooltipOpen] = useCardTooltip(tooltips);
  const def = enemy ? enemyCard(definition(card.definitionId)) : definition(card.definitionId);
  const effectText = cardText(
    def,
    card.level,
    enemyValue ??
      Math.round(
        actionValue(card, actor ?? { species: def.species, attacked: false }, modifiers) +
          (modifiers && actor && def.effect === "attack" && def.damageType === "physical"
            ? physicalBonus(actor, modifiers)
            : 0),
      ),
    enemyPower,
  );
  const artwork = (
    <ArtCard
      aspect="action"
      artwork={assetUrl(def.artwork ?? `action.${def.species}`)}
      presentation={presentation}
      tabIndex={presentation ? undefined : 0}
      className={selected ? "selected" : undefined}
      effectText={effectText}
      data-card-id={card.id}
      data-effect={def.effect}
      data-consume={def.consume || undefined}
      aria-label={
        label ??
        `${def.name}${card.level ? ` +${card.level}` : ""}, ${ownerName}, ${enemy ? "" : `${modifiers ? cardCost(card, modifiers) : def.cost} mana, `}${effectText}`
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
          compact
          card={card}
          ownerName={ownerName}
          actor={actor}
          modifiers={modifiers}
          enemy={enemy}
          enemyValue={enemyValue}
          enemyPower={enemyPower}
        />
      </TooltipContent>
    </Tooltip>
  );
}
