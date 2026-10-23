import type { GameEvent } from "../../game/types";
import { useBattleArtworkSize } from "./use-battle-artwork-size";
import { battlefield } from "../../game/battlefield";
import { sharedDodgeChance } from "../../game/combat/index";
import { Screen } from "../shared/navigation/screen";
import { HandMotion } from "./hand-motion";
import { combatStatuses } from "../shared/combat/combat-status";
import { motionValue } from "../shared/motion-values";
import { ActionDetails } from "../shared/cards/card-details";
import { cardCost } from "../../game/ability-rules";
import { controlled } from "../../game/combat/index";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { ActionCard, AllyCard, EnemyCard } from "../shared/cards/cards";
import { definition, species } from "../../game/content";
import type { Command, BattleState } from "../../game/types";
import { previewPlay } from "../../game/preview";
import type { InputAction } from "../shared/navigation/input";
import { returnFocus } from "../shared/navigation/focus";
import { TargetPreview } from "./target-preview";
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
  const [selected, setSelected] = useState<string | null>(null);
  const [previousClear, setPreviousClear] = useState(clearSelection);
  if (previousClear !== clearSelection) {
    setPreviousClear(clearSelection);
    if (clearSelection) setSelected(null);
  }
  const [hovered, setHovered] = useState<string | null>(null);
  const [denial, setDenial] = useState("");
  useEffect(() => {
    if (!denial) return;
    const timer = setTimeout(() => setDenial(""), motionValue("--target-denial-duration"));
    return () => clearTimeout(timer);
  }, [denial]);
  const [remembered, setRemembered] = useState<{ enemy?: string; ally?: string }>({});
  const board = useRef<HTMLElement>(null);
  useBattleArtworkSize(board);
  const [line, setLine] = useState("");
  const focusAfterCommand = useRef<number | null>(null);
  const battle = game.battle;
  const enemyRow = battlefield(game, "enemy");
  const playerRow = battlefield(game, "player");
  const visibleHand = battle.hand.filter((id) =>
    game.team.some((c) => c.health > 0 && c.id === game.cards.find((card) => card.id === id)?.ownerId),
  );
  const card = game.cards.find((c) => c.id === selected),
    def = card ? definition(card.definitionId) : null;
  const enemyTarget = def?.effect === "attack" && !def.target;
  const allyTarget =
    (def?.effect === "guard" && def.target !== "self") || (def?.effect === "heal" && !def.target);
  const targetOrder = <T extends { id: string }>(row: T[]) =>
    row.length > 1 &&
    (enemyTarget ? battle.enemies : game.team).some((unit) => species(unit.species).legendary)
      ? [row[1]!, row[0]!, ...row.slice(2)]
      : row;
  const targets = enemyTarget
    ? targetOrder(enemyRow)
        .filter((e) => e.health > 0)
        .map((e) => e.id)
    : allyTarget
      ? targetOrder(playerRow)
          .filter((c) => c.health > 0)
          .map((c) => c.id)
      : [];
  const last = enemyTarget ? remembered.enemy : remembered.ally;
  const navigationTarget = targets.includes(last ?? "") ? last : targets[0];
  const target = navigateFocus ? navigationTarget : targets.includes(hovered ?? "") ? hovered! : undefined;
  const setTarget = (id: string) => {
    setHovered(id);
    const side = enemyTarget ? "enemy" : "ally";
    setRemembered((old) => (old[side] === id ? old : { ...old, [side]: id }));
  };
  const preview = usePlayPreview(game, selected, target);
  const affected = new Set(
    preview?.events.flatMap((event) => (event.targetId ? [event.targetId] : [])) ?? [],
  );
  if (preview?.accepted) {
    for (const unit of [...playerRow, ...enemyRow]) {
      const next = [...battlefield(preview.state, "player"), ...battlefield(preview.state, "enemy")].find(
        (candidate) => candidate.id === unit.id,
      );
      if (
        next &&
        (next.health !== unit.health ||
          next.block !== unit.block ||
          JSON.stringify(combatStatuses(next.combat, sharedDodgeChance(preview.state, next))) !==
            JSON.stringify(combatStatuses(unit.combat, sharedDodgeChance(game, unit))))
      )
        affected.add(unit.id);
    }
  }
  if (target) affected.add(target);
  const allyRecipient = playerRow.find((unit) => unit.id === target);
  const recipient =
    enemyRow.find((unit) => unit.id === target)?.name ??
    (allyRecipient
      ? "name" in allyRecipient
        ? allyRecipient.name
        : species(allyRecipient.species).name
      : undefined);
  const play = (command: Command) => {
    if (!send(command)) return;
    setSelected(null);
    setHovered(null);
    setDenial("");
    focusAfterCommand.current = navigateFocus
      ? Math.max(0, visibleHand.indexOf(command.type === "play" ? command.cardId : ""))
      : null;
  };
  useLayoutEffect(() => {
    if (focusAfterCommand.current !== null && !selected) {
      const cards = Array.from(board.current?.querySelectorAll<HTMLElement>(".hand .action-card") ?? []);
      const index = Math.min(focusAfterCommand.current, cards.length - 1);
      focusAfterCommand.current = null;
      returnFocus(cards[index] ?? board.current?.querySelector<HTMLElement>(".end-turn") ?? null);
    }
  }, [game.revision, selected]);
  const cancel = useCallback(() => {
    const opener = board.current?.querySelector<HTMLElement>(`[data-card-id="${selected}"]`) ?? null;
    setSelected(null);
    setHovered(null);
    if (navigateFocus) returnFocus(opener);
  }, [selected, navigateFocus]);
  useEffect(() => {
    const root = board.current;
    const clear = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        !(event.target instanceof Element) ||
        event.target.closest("button, a, input, [role=dialog], [role=tooltip]")
      )
        return;
      setSelected(null);
    };
    root?.addEventListener("pointerdown", clear);
    return () => root?.removeEventListener("pointerdown", clear);
  }, []);
  const handle = (action: InputAction) => {
    if (action === "back" && selected) {
      cancel();
      return true;
    }
    if (action === "endTurn") {
      play({ type: "endTurn" });
      return true;
    }
    if (selected && targets.length && (action === "left" || action === "right")) {
      const next =
        targets[
          (targets.indexOf(navigationTarget!) + (action === "left" ? -1 : 1) + targets.length) %
            targets.length
        ]!;
      setTarget(next);
      // Navigation may start from another row, including when only one target remains.
      board.current?.querySelector<HTMLElement>(`[data-actor-id="${next}"] .creature-card`)?.focus();
      return true;
    }
    return false;
  };
  useLayoutEffect(() => {
    controlsRef.current = handle;
    return () => {
      controlsRef.current = null;
    };
  });
  useLayoutEffect(() => {
    if (!selected || !target || !navigateFocus) return;
    board.current?.querySelector<HTMLElement>(`[data-actor-id="${target}"] .creature-card`)?.focus();
  }, [selected, target, navigateFocus]);
  useLayoutEffect(() => {
    const update = () => {
      const root = board.current;
      const actor = root?.querySelector(`[data-actor-id="${card?.ownerId}"] .creature-card`);
      const recipient = root?.querySelector(`[data-actor-id="${target}"] .creature-card`);
      if (!root || !actor || !recipient || !selected || !target) {
        setLine("");
        return;
      }
      const origin = root.getBoundingClientRect(),
        a = actor.getBoundingClientRect(),
        b = recipient.getBoundingClientRect();
      const x = a.x + (card?.ownerId === target ? 0 : a.width / 2) - origin.x,
        y = a.y - origin.y - 8,
        endX = allyTarget ? b.x + b.width / 2 - origin.x : b.right - origin.x + 6,
        endY = allyTarget ? b.y - origin.y - 8 : b.bottom - origin.y - 10;
      const arch = Math.min(y, endY) - 32;
      setLine(
        allyTarget
          ? `M ${x} ${y} C ${x} ${arch}, ${endX} ${arch}, ${endX} ${endY}`
          : `M ${x} ${y} C ${endX} ${y - 24}, ${endX} ${endY + 24}, ${endX} ${endY}`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    if (board.current) observer.observe(board.current);
    return () => {
      observer.disconnect();
    };
  }, [card?.ownerId, selected, target, allyTarget]);
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
              onPreviewEnd={() => setHovered((old) => (old === enemy.id ? null : old))}
              onPreview={() => {
                if (selected && enemyTarget && enemy.health > 0) setTarget(enemy.id);
              }}
              preview={
                selected && affected.has(enemy.id) ? (
                  <TargetPreview before={game} result={preview} targetId={enemy.id} />
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
              onPreviewEnd={() => setHovered((old) => (old === creature.id ? null : old))}
              invalidTarget={!!selected && (!allyTarget || creature.health <= 0)}
              onPreview={() => {
                if (selected && allyTarget && creature.health > 0) setTarget(creature.id);
              }}
              preview={
                selected && affected.has(creature.id) ? (
                  <TargetPreview before={game} result={preview} targetId={creature.id} />
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
                        setDenial(
                          controlled(owner)
                            ? `${species(owner.species).name} cannot act ${owner.combat?.controlled ? `while ${owner.combat.controlled === "freeze" ? "Frozen" : "Stunned"}` : "this turn"}.`
                            : "Not enough Mana.",
                        );
                        onDenied(element);
                      }}
                      onClick={() => {
                        onManualStart?.();
                        setHovered(null);
                        setDenial("");
                        const action = definition(card.definitionId);
                        const needsTarget =
                          (action.effect === "attack" && !action.target) ||
                          (action.effect === "guard" && action.target !== "self") ||
                          (action.effect === "heal" && !action.target);
                        if (needsTarget) setSelected((old) => (old === id ? null : id));
                        else play({ type: "play", cardId: id });
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
