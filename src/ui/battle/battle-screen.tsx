import type { GameEvent } from "../../game/types";
import { useBattleArtworkSize } from "./use-battle-artwork-size";
import { sharedDodgeChance } from "../../game/combat/index";
import { Screen } from "../shared/navigation/screen";
import { HandMotion } from "./hand-motion";
import { ActionDetails } from "../shared/cards/card-details";
import { cardCost } from "../../game/ability-rules";
import { controlled } from "../../game/combat/index";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { ActionCard, AllyCard, EnemyCard } from "../shared/cards/cards";
import { species } from "../../game/content";
import type { Command, BattleState } from "../../game/types";
import { previewPlay } from "../../game/preview";
import { TargetPreview } from "./target-preview";
import { useBattleInteraction } from "./battle-interaction";
import { useTargetLine } from "./use-target-line";
import { playPreviewModel } from "./play-preview-model";
import { unitName } from "../../game/combat/state";
import { CombatFeedback, type Burst } from "./combat-feedback";
import { ManaCrystals } from "./mana-crystals";
import { ArtCard } from "../shared/cards/art-card";
import { assetUrl } from "../shared/assets";
import type { Controls } from "../shared/navigation/input";
function usePlayPreview(game: BattleState, cardId: string | null, targetId?: string) {
  return useMemo(
    () => (cardId && targetId ? previewPlay(game, cardId, targetId) : null),
    [game, cardId, targetId],
  );
}
function FanSlot({ index, count, children }: { index: number; count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const offset = index - (count - 1) / 2;
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
  navigateFocus: boolean;
  onDenied: (element: HTMLElement) => void;
  onManualStart?: () => void;
  clearSelection?: boolean;
  openPile?: (pile: "draw" | "discard") => void;
  openingDraw?: boolean;
}) {
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
    setTarget,
    leaveTarget,
    deny,
    chooseCard,
    play,
    cancel,
  } = interaction;
  const battle = game.battle;
  const preview = usePlayPreview(game, selected, target);
  const model = useMemo(() => playPreviewModel(game, preview, target), [game, preview, target]);
  const recipientUnit = [...enemyRow, ...playerRow].find((unit) => unit.id === target);
  const recipient = recipientUnit ? unitName(recipientUnit) : undefined;
  const line = useTargetLine(board, card?.ownerId, selected, target, allyTarget);
  return (
    <Screen
      ref={board}
      className="battle-screen"
      aria-label="Battlefield"
      data-selected-card={selected ?? ""}
    >
      <CombatFeedback bursts={bursts} root={board} />
      <section
        className="enemy-row"
        aria-label="Enemy row"
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
                  <TargetPreview forecast={model.units.get(enemy.id)} />
                ) : undefined
              }
              onClick={(element) => {
                if (selected) {
                  if (enemyTarget && enemy.health > 0)
                    play({ type: "play", cardId: selected, targetId: enemy.id });
                  else onDenied(element);
                }
              }}
              label={selected && enemyTarget && enemy.health > 0 ? `Target ${enemy.name}` : enemy.name}
            />
          ))}
      </section>
      <section
        className="player-row"
        aria-label="Player row"
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
              acting={card?.ownerId === creature.id}
              validTarget={!!selected && creature.health > 0 && allyTarget}
              activeTarget={!!selected && creature.health > 0 && target === creature.id}
              onPreviewEnd={() => leaveTarget(creature.id)}
              invalidTarget={!!selected && (!allyTarget || creature.health <= 0)}
              onPreview={() => {
                if (selected && allyTarget && creature.health > 0) setTarget(creature.id);
              }}
              preview={
                selected && model.affected.has(creature.id) ? (
                  <TargetPreview forecast={model.units.get(creature.id)} />
                ) : undefined
              }
              onClick={(element) => {
                if (selected) {
                  if (allyTarget && creature.health > 0)
                    play({ type: "play", cardId: selected, targetId: creature.id });
                  else onDenied(element);
                }
              }}
              label={
                selected && allyTarget && creature.health > 0
                  ? `Target ${"name" in creature ? creature.name : species(creature.species).name}`
                  : "name" in creature
                    ? creature.name
                    : species(creature.species).name
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
                {species(def.species).name} ·{" "}
                {recipient ?? (enemyTarget ? "Choose an enemy" : "Choose an ally")}
              </p>
              <ActionDetails
                compact
                card={card}
                ownerName={species(def.species).name}
                actor={game.team.find((unit) => unit.id === card.ownerId)}
                modifiers={game}
              />
              {preview?.events
                .filter(
                  (event): event is Extract<GameEvent, { kind: "status" }> =>
                    event.kind === "status" && !event.targetId,
                )
                .map((event, index) => (
                  <p key={index}>{event.text}</p>
                ))}
            </>
          ) : null}
        </div>
        {selected ? (
          <Button variant="outline" onClick={cancel}>
            Cancel
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
        <section className="hand-toolbar" aria-label="Battle cards and controls" data-nav-row>
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
                aria-label="Inspect Draw Pile"
                onClick={() => openPile?.("draw")}
              />
            </div>
          </div>
          <section className="hand-section" aria-label="Action hand">
            <div className="hand">
              {visibleHand.map((id, index, hand) => {
                const card = game.cards.find((c) => c.id === id)!,
                  owner = game.team.find((c) => c.id === card.ownerId)!;
                return (
                  <FanSlot key={id} index={index} count={hand.length}>
                    <ActionCard
                      card={card}
                      actor={owner}
                      modifiers={game}
                      ownerName={species(owner.species).name}
                      selected={selected === id}
                      disabled={battle.mana < cardCost(card, game) || controlled(owner)}
                      onDenied={(element) => {
                        deny(
                          controlled(owner)
                            ? `${species(owner.species).name} cannot act ${owner.combat?.controlled ? `while ${owner.combat.controlled === "freeze" ? "Frozen" : "Stunned"}` : "this turn"}.`
                            : "Not enough Mana.",
                        );
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
              <Button className="end-turn" onClick={() => play({ type: "endTurn" })}>
                End turn{controller ? ` · ${endTurnPrompt}` : ""}
              </Button>
            </div>
            <div className="battle-pile">
              <ArtCard
                artwork={assetUrl("pile.discard")}
                aspect="action"
                data-pile="discard"
                aria-label="Inspect Discard Pile"
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
