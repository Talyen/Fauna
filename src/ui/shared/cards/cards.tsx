import { cardRuleId } from "../localization/card-rule-id";
import { structuredCardRule } from "../localization/structured-card-rule";
import { useRuleText } from "../localization/rule-catalog";
import { useMessages } from "../localization/message-context";
import { useEffectBaseline } from "../effects/effects";
import { creatureKeywords, effectPalette, visualKeywords } from "../effects/palettes";
import { CombatStatus } from "../combat/combat-status";
import { assetUrl } from "../assets";
import { useState, type ComponentProps, type ReactNode } from "react";
import { BattleReadout } from "../combat/battle-readout";
import { ArtCard } from "./art-card";
import { ActionDetails, CreatureDetails } from "./card-details";
import { actionDisplay } from "./action-display";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip";
import { cardCost } from "../../../game/ability-rules";
import { species } from "../../../game/content";
import { cardText } from "../../../game/card-rules";
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
  battleSlot?: "left" | "center" | "right";
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
  sharedDodge?: number;
  sharedImmunity?: number;
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
  selected,
  disabled = false,
  onClick,
  onInspect,
  label,
  presentation = false,
  enemyId,
  actorId,
  battleSlot,
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
  sharedDodge = 0,
  sharedImmunity = 0,
}: CreatureProps) {
  const i18n = useMessages();
  const [tooltipOpen, setTooltipOpen] = useCardTooltip(tooltips);
  const info = species(kind);
  useEffectBaseline(selected ? effectPalette(creatureKeywords(kind, progression)) : null, 1);
  const artwork = (
    <ArtCard
      aspect="creature"
      artwork={assetUrl(artworkId ?? `creature.${kind}`)}
      effectKeywords={artworkId?.startsWith("minion.") ? [] : creatureKeywords(kind, progression)}
      urgent={health !== 0 && !!combat?.grace}
      acting={acting}
      control={health === 0 ? null : combat?.controlled}
      presentation={presentation}
      className={[selected ? "selected" : "", invalidTarget ? "invalid-target" : ""].join(" ")}
      data-species={kind}
      data-enemy-id={enemyId}
      aria-label={
        label ??
        (artworkId?.startsWith("minion.")
          ? artworkId === "minion.gilded-ward"
            ? i18n.message("creature.gildedWard", "Gilded Ward")
            : artworkId === "minion.pendulum"
              ? i18n.message("creature.pendulum", "Pendulum")
              : artworkId === "minion.royal-bloom"
                ? i18n.message("creature.royalBloom", "Royal Bloom")
                : i18n.message("creature.echo", "Echo")
          : i18n.content(`content.species.${kind}.name`, info.name))
      }
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
      data-battle-slot={battleSlot}
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
                {tooltipContent ?? <CreatureDetails progression={progression} kind={kind} name={name} />}
                {readout && health !== undefined && (actorId || enemyId) ? (
                  <p className="creature-health-detail">
                    {i18n.message("creature.healthFraction", "Health {{health}}/{{maximum}}", {
                      health,
                      maximum: maxHealth ?? info.health,
                    })}
                  </p>
                ) : null}
              </TooltipContent>
            </Tooltip>
          )}
          <div className="combatant-details">
            {preview ? (
              preview
            ) : readout && health !== undefined && (actorId || enemyId) ? (
              <BattleReadout health={health} maxHealth={maxHealth ?? info.health} block={block} />
            ) : null}
            {readout ? (
              <CombatStatus combat={combat} sharedDodge={sharedDodge} sharedImmunity={sharedImmunity} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function minionArtwork(kind: SpeciesId) {
  return kind === "tithemaw"
    ? "minion.gilded-ward"
    : kind === "chronora"
      ? "minion.pendulum"
      : kind === "velvetmonarch"
        ? "minion.royal-bloom"
        : "minion.echo";
}

function MinionDetails({ kind }: { kind: SpeciesId }) {
  const i18n = useMessages();
  return (
    <div className="card-details">
      <strong>
        {kind === "tithemaw"
          ? i18n.message("creature.gildedWard", "Gilded Ward")
          : kind === "chronora"
            ? i18n.message("creature.pendulum", "Pendulum")
            : kind === "velvetmonarch"
              ? i18n.message("creature.royalBloom", "Royal Bloom")
              : i18n.message("creature.echo", "Echo")}
      </strong>
      {kind === "tithemaw" && (
        <p>
          {i18n.message(
            "creature.gildedWardRule",
            "When its owner attacks, deal 1 Light damage to all enemies",
          )}
        </p>
      )}
      {kind === "chronora" && (
        <p>{i18n.message("creature.pendulumRule", "Chronora’s attacks deal 1 extra damage")}</p>
      )}
      {kind === "velvetmonarch" && (
        <p>
          {i18n.message(
            "creature.royalBloomRule",
            "With The Garden Answers, attacks a random enemy when its owner gains Block",
          )}
        </p>
      )}
    </div>
  );
}

export function AllyCard({
  creature,
  ...props
}: { creature: Creature | Enemy } & Omit<CreatureProps, "kind" | "health" | "block">) {
  const minion = "minion" in creature && creature.minion;
  return (
    <CreatureCard
      actorId={creature.id}
      artworkId={minion ? minionArtwork(creature.species) : undefined}
      name={"name" in creature ? creature.name : undefined}
      maxHealth={"maxHealth" in creature ? creature.maxHealth : undefined}
      tooltipContent={minion ? <MinionDetails kind={creature.species} /> : undefined}
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
      artworkId={enemy.minion ? minionArtwork(enemy.species) : undefined}
      tooltipContent={enemy.minion ? <MinionDetails kind={enemy.species} /> : undefined}
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
  const i18n = useMessages();
  const [tooltipOpen, setTooltipOpen] = useCardTooltip(tooltips);
  const { def, value } = actionDisplay(card, actor, modifiers);
  const effectText = cardText(def, card.level, value, 1, modifiers);
  const structured = structuredCardRule(def, card.level, value, 1, effectText);
  const effectLabel = useRuleText(
    effectText,
    structured?.id ?? cardRuleId(def, modifiers, effectText),
    structured?.message,
  )
    .map((part) => part.text)
    .join("");
  const name = i18n.content(`content.card.${def.id}.name`, def.name);
  const nameLabel = card.level
    ? i18n.message("card.upgradedName", "{{name}} +{{level}}", { name, level: card.level })
    : name;
  const accessibleLabel = i18n.message("card.actionLabel", "{{name}}, {{owner}}, {{mana}} mana, {{effect}}", {
    name: nameLabel,
    owner: ownerName,
    mana: modifiers ? cardCost(card, modifiers) : def.cost,
    effect: effectLabel,
  });
  useEffectBaseline(selected ? effectPalette(visualKeywords(effectText)) : null, 1);
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
      aria-label={label ?? accessibleLabel}
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
        <ActionDetails compact card={card} ownerName={ownerName} actor={actor} modifiers={modifiers} />
      </TooltipContent>
    </Tooltip>
  );
}
