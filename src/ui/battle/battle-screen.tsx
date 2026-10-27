import { useMessages } from "../shared/localization/message-context";
import { measurePerformance } from "../../lib/performance";
import { useBattleArtworkSize } from "./use-battle-artwork-size";
import { sharedDodgeChance } from "../../game/combat/index";
import { Screen } from "../shared/navigation/screen";
import { HandMotion } from "./hand-motion";
import { ActionDetails } from "../shared/cards/card-details";
import { MAX_HAND_SIZE } from "../../game/card-zones";
import { cardCost } from "../../game/ability-rules";
import { cardActor } from "../../game/card-actors";
import { inspectCardPlay } from "../../game/play-queries";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { ActionCard, AllyCard, EnemyCard } from "../shared/cards/cards";
import { species } from "../../game/content";
import type { Command, BattleState } from "../../game/types";
import { projectPlay } from "../../game/preview";
import { TargetPreview } from "./target-preview";
import { useBattleInteraction } from "./battle-interaction";
import { useTargetLine } from "./use-target-line";
import { playPreviewModel } from "./play-preview-model";
import { localizedCombatantName } from "../shared/localization/combatant-name";
import { localizedCardDenial } from "../shared/localization/card-denial";
import { localizedPreviewMessage } from "../shared/localization/event-presentation";
import { CombatFeedback, type Burst } from "./combat-feedback";
import { ManaCrystals } from "./mana-crystals";
import { ArtCard } from "../shared/cards/art-card";
import { assetUrl } from "../shared/assets";
import type { Controls } from "../shared/navigation/input";
function usePlayPreview(game: BattleState, cardId: string | null, targetId?: string) {
  return useMemo(
    () => (cardId && targetId ? cachedPreview(game, cardId, targetId) : null),
    [game, cardId, targetId],
  );
}
const emptyPreview: ReturnType<typeof playPreviewModel> = {
  affected: new Set<string>(),
  units: new Map(),
  messages: [] as readonly string[],
};
const previewCache = new WeakMap<BattleState, Map<string, ReturnType<typeof playPreviewModel>>>();
function cachedPreview(game: BattleState, cardId: string, targetId: string) {
  let cache = previewCache.get(game);
  if (!cache) {
    cache = new Map();
    previewCache.set(game, cache);
  }
  const key = JSON.stringify([cardId, targetId]);
  const prior = cache.get(key);
  if (prior) return prior;
  const result = measurePerformance(
    "target-preview",
    () => {
      const projection = projectPlay(game, cardId, targetId);
      return measurePerformance("preview-model", () => playPreviewModel(game, projection, targetId), {
        revision: game.revision,
      });
    },
    { revision: game.revision, cardId, targetId },
  );
  if (cache.size >= 12) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
function FanSlot({ index, count, children }: { index: number; count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const span = Math.max(MAX_HAND_SIZE - 1, count - 1);
    const offset = ((index - (count - 1) / 2) * (MAX_HAND_SIZE - 1)) / span;
    const style = ref.current!.style;
    style.setProperty("--fan-offset", String(offset));
    style.setProperty("--fan-order", String(index));
    style.setProperty("--hand-count", String(count));
  }, [index, count]);
  return (
    <div className="hand-slot" ref={ref}>
      <div className="hand-reflow">{children}</div>
    </div>
  );
}
export function BattleScreen({
  game,
  send,
  controls: controlsRef,
  bursts,
  controller,
  endTurnPrompt = "Y",
  endTurnPromptLabel = endTurnPrompt,
  navigateFocus,
  onDenied,
  clearSelection = false,
  onManualStart,
  openPile,
  openingDraw = false,
}: {
  game: BattleState;
  send: (command: Command) => boolean;
  controls: Controls;
  bursts: readonly Burst[];
  controller: boolean;
  endTurnPrompt?: string;
  endTurnPromptLabel?: string;
  navigateFocus: boolean;
  onDenied: (element: HTMLElement) => void;
  onManualStart?: () => void;
  clearSelection?: boolean;
  openPile?: (pile: "draw" | "discard") => void;
  openingDraw?: boolean;
}) {
  const i18n = useMessages();
  const board = useRef<HTMLElement>(null);
  useBattleArtworkSize(board);
  const interaction = useBattleInteraction({
    game,
    send,
    controls: controlsRef,
    navigateFocus,
    clearSelection,
    board,
  });
  const {
    selected,
    denial,
    card,
    def,
    target,
    enemyTarget,
    allyTarget,
    enemyRow,
    playerRow,
    visibleHand,
    legalTargets,
    setTarget,
    leaveTarget,
    deny,
    chooseCard,
    play,
    cancel,
  } = interaction;
  const battle = game.battle;
  const preview = usePlayPreview(game, selected, target);
  const model = preview ?? emptyPreview;
  const recipientUnit = [...enemyRow, ...playerRow, ...game.reserves].find((unit) => unit.id === target);
  const recipient = recipientUnit ? localizedCombatantName(recipientUnit, i18n) : undefined;
  const acting = card ? cardActor(game, card) : undefined;
  const line = useTargetLine(board, acting?.id, selected, target, allyTarget);
  return (
    <Screen
      ref={board}
      className="battle-screen"
      data-nav-layout="rows"
      aria-label={i18n.message("battle.battlefield", "Battlefield")}
      data-selected-card={selected ?? ""}
    >
      <CombatFeedback bursts={bursts} root={board} />
      <section
        className="enemy-row"
        data-nav-row
        aria-label={i18n.message("battle.enemyRow", "Enemy row")}
        data-legendary={battle.enemies.some((unit) => species(unit.species).legendary) || undefined}
      >
        {enemyRow
          .filter((unit) => !unit.minion || unit.health > 0)
          .map((enemy) => (
            <EnemyCard
              key={enemy.id}
              enemy={enemy}
              sharedDodge={sharedDodgeChance(game, enemy)}
              tooltips={!selected}
              invalidTarget={!!selected && (!enemyTarget || enemy.health <= 0)}
              validTarget={!!selected && enemyTarget && enemy.health > 0}
              activeTarget={!!selected && target === enemy.id}
              onPreviewEnd={() => leaveTarget(enemy.id)}
              onPreview={() => {
                if (selected && enemyTarget && enemy.health > 0) setTarget(enemy.id);
              }}
              preview={
                selected && model.affected.has(enemy.id) ? (
                  <TargetPreview
                    forecast={model.units.get(enemy.id)}
                    displayName={localizedCombatantName(enemy, i18n)}
                  />
                ) : undefined
              }
              onClick={(element) => {
                if (selected) {
                  if (enemyTarget && enemy.health > 0)
                    play({ type: "play", cardId: selected, targetId: enemy.id });
                  else onDenied(element);
                }
              }}
              label={
                selected && enemyTarget && enemy.health > 0
                  ? i18n.message("battle.target", "Target {{name}}", {
                      name: localizedCombatantName(enemy, i18n),
                    })
                  : localizedCombatantName(enemy, i18n)
              }
            />
          ))}
      </section>
      <section
        className="player-row"
        data-nav-row
        aria-label={i18n.message("battle.playerRow", "Player row")}
        data-legendary={game.team.some((unit) => species(unit.species).legendary) || undefined}
      >
        {playerRow
          .filter((unit) => !("minion" in unit) || unit.health > 0)
          .map((creature) => (
            <AllyCard
              progression={game}
              key={creature.id}
              creature={creature}
              sharedDodge={sharedDodgeChance(game, creature)}
              tooltips={!selected}
              acting={acting?.id === creature.id}
              validTarget={!!selected && legalTargets.has(creature.id) && allyTarget}
              activeTarget={!!selected && legalTargets.has(creature.id) && target === creature.id}
              onPreviewEnd={() => leaveTarget(creature.id)}
              invalidTarget={!!selected && (!allyTarget || !legalTargets.has(creature.id))}
              onPreview={() => {
                if (selected && allyTarget && legalTargets.has(creature.id)) setTarget(creature.id);
              }}
              preview={
                selected && model.affected.has(creature.id) ? (
                  <TargetPreview
                    forecast={model.units.get(creature.id)}
                    displayName={localizedCombatantName(creature, i18n)}
                  />
                ) : undefined
              }
              onClick={(element) => {
                if (selected) {
                  if (allyTarget && legalTargets.has(creature.id))
                    play({ type: "play", cardId: selected, targetId: creature.id });
                  else onDenied(element);
                }
              }}
              label={
                selected && allyTarget && legalTargets.has(creature.id)
                  ? i18n.message("battle.target", "Target {{name}}", {
                      name: localizedCombatantName(creature, i18n),
                    })
                  : localizedCombatantName(creature, i18n)
              }
            />
          ))}
      </section>
      <div className="target-control">
        <div className="target-summary" role="status" aria-live="polite">
          {denial ? (
            <p>{denial}</p>
          ) : card && def ? (
            <>
              <p>
                {i18n.message("battle.targetSummary", "{{owner}} · {{target}}", {
                  owner:
                    def.species === null
                      ? i18n.message("battle.food", "Food")
                      : acting
                        ? i18n.content(`content.species.${acting.species}.name`, species(acting.species).name)
                        : i18n.content(`content.species.${def.species}.name`, species(def.species).name),
                  target:
                    recipient ??
                    (enemyTarget
                      ? i18n.message("battle.chooseEnemy", "Choose an enemy")
                      : def.effect === "swapChosen"
                        ? i18n.message("battle.chooseBackup", "Choose a backup")
                        : i18n.message("battle.chooseAlly", "Choose an ally")),
                })}
              </p>
              <ActionDetails
                compact
                card={card}
                ownerName={
                  def.species === null
                    ? i18n.message("battle.food", "Food")
                    : acting
                      ? i18n.content(`content.species.${acting.species}.name`, species(acting.species).name)
                      : i18n.content(`content.species.${def.species}.name`, species(def.species).name)
                }
                actor={acting}
                modifiers={game}
              />
              {def.effect === "resurrect" || def.effect === "swapChosen"
                ? game.reserves
                    .filter((unit) => legalTargets.has(unit.id))
                    .map((unit) => (
                      <Button
                        key={unit.id}
                        variant="outline"
                        data-backup-target={unit.id}
                        data-resurrection-target={def.effect === "resurrect" ? unit.id : undefined}
                        aria-label={
                          def.effect === "swapChosen"
                            ? i18n.message("battle.swapBackup", "Swap in {{name}} from backup", {
                                name: localizedCombatantName(unit, i18n),
                              })
                            : i18n.message("battle.resurrectBackup", "Resurrect {{name}} from backup", {
                                name: localizedCombatantName(unit, i18n),
                              })
                        }
                        onFocus={() => setTarget(unit.id)}
                        onMouseEnter={() => setTarget(unit.id)}
                        onMouseLeave={() => leaveTarget(unit.id)}
                        onClick={() => play({ type: "play", cardId: card.id, targetId: unit.id })}
                      >
                        {def.effect === "resurrect"
                          ? i18n.message("battle.backupName", "{{name}} (backup)", {
                              name: localizedCombatantName(unit, i18n),
                            })
                          : localizedCombatantName(unit, i18n)}
                      </Button>
                    ))
                : null}
              {model.messages.map((message, index) => (
                <p key={index}>{localizedPreviewMessage(message, i18n)}</p>
              ))}
            </>
          ) : null}
        </div>
        {selected ? (
          <Button variant="outline" onClick={cancel}>
            {i18n.message("common.cancel", "Cancel")}
          </Button>
        ) : null}
      </div>
      <HandMotion
        revision={game.revision}
        turn={battle.turn}
        opening={openingDraw}
        paused={clearSelection}
        cardIds={game.cards.map((card) => card.id)}
      >
        <section
          className="hand-toolbar"
          aria-label={i18n.message("battle.cardsAndControls", "Battle cards and controls")}
          data-nav-row
        >
          <div className="battle-dock">
            <ManaCrystals
              mana={battle.mana}
              maximum={battle.maxMana}
              previewCost={card ? cardCost(card, game) : 0}
            />
            <div className="battle-pile">
              <ArtCard
                artwork={assetUrl("pile.draw")}
                aspect="action"
                data-pile="draw"
                aria-label={i18n.message("battle.inspectDrawPile", "Inspect Draw Pile")}
                onClick={() => openPile?.("draw")}
              />
            </div>
          </div>
          <section className="hand-section" aria-label={i18n.message("battle.actionHand", "Action hand")}>
            <div className="hand">
              {visibleHand.map((id, index, hand) => {
                const card = game.cards.find((c) => c.id === id)!,
                  owner = cardActor(game, card)!,
                  admission = inspectCardPlay(game, card.id);
                return (
                  <FanSlot key={id} index={index} count={hand.length}>
                    <ActionCard
                      card={card}
                      actor={owner}
                      modifiers={game}
                      ownerName={
                        card.ownerId === null
                          ? i18n.message("battle.food", "Food")
                          : i18n.content(`content.species.${owner.species}.name`, species(owner.species).name)
                      }
                      selected={selected === id}
                      disabled={!admission.allowed}
                      onDenied={(element) => {
                        deny(admission.allowed ? "" : localizedCardDenial(admission.reason, owner, i18n));
                        onDenied(element);
                      }}
                      onClick={() => {
                        onManualStart?.();
                        chooseCard(id);
                      }}
                    />
                  </FanSlot>
                );
              })}
            </div>
          </section>
          <div className="battle-dock">
            <div className="battle-actions">
              {battle.repeatNext.player ? (
                <span className="next-card-repeat" role="status">
                  {i18n.message("battle.nextCardRepeat", "Next card ×2")}
                </span>
              ) : null}
              <Button
                className="end-turn"
                aria-label={
                  controller
                    ? i18n.message("battle.endTurnPrompt", "End turn · {{prompt}}", {
                        prompt: endTurnPromptLabel,
                      })
                    : undefined
                }
                onClick={() => play({ type: "endTurn" })}
              >
                <span>{i18n.message("battle.endTurn", "End turn")}</span>
                {controller ? <span aria-hidden="true">{endTurnPrompt}</span> : null}
              </Button>
            </div>
            <div className="battle-pile">
              <ArtCard
                artwork={assetUrl("pile.discard")}
                aspect="action"
                data-pile="discard"
                aria-label={i18n.message("battle.inspectDiscardPile", "Inspect Discard Pile")}
                onClick={() => openPile?.("discard")}
              />
            </div>
          </div>
        </section>
      </HandMotion>
      {line ? (
        <svg className="target-line" aria-hidden="true">
          <defs>
            <marker
              id="target-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 6 3 L 0 6" />
            </marker>
          </defs>
          <path d={line} markerEnd="url(#target-arrow)" />
        </svg>
      ) : null}
    </Screen>
  );
}
