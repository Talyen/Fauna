import { Screen } from "./screen";
import { HandMotion } from "./hand-motion";
import { combatStatuses } from "./combat-status";
import { motionValue } from "./motion-values";
import { ActionDetails } from "./card-details";
import { cardCost } from "../game/rules";
import { controlled } from "../game/combat";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { Button } from "../components/ui/button";
import { ActionCard, AllyCard, EnemyCard } from "./cards";
import { definition, species } from "../game/content";
import type { Card, Command, GameState } from "../game/types";
import { previewPlay } from "../game/preview";
import type { InputAction } from "./input";
import { returnFocus } from "./focus";
import { TargetPreview } from "./target-preview";
import { CombatFeedback, type Burst } from "./combat-feedback";
import { ManaCrystals } from "./mana-crystals";
import { ArtCard } from "./art-card";
import { assetUrl } from "./assets";
export type Inspection =
  { card: Card } | { species: GameState["selected"][number]; enemyId?: string; creatureId?: string };
export type Controls = MutableRefObject<((action: InputAction) => boolean) | null>;
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
  inspect,
  controls,
  bursts,
  controller,
  navigateFocus,
  onDenied,
  actions,
  clearSelection = false,
  onManualStart,
  openPile,
  openingDraw = false,
}: {
  game: GameState;
  send: (command: Command) => boolean;
  inspect: (item: Inspection) => void;
  controls: Controls;
  bursts: readonly Burst[];
  controller: boolean;
  navigateFocus: boolean;
  onDenied: (element: HTMLElement) => void;
  actions?: ReactNode;
  onManualStart?: () => void;
  clearSelection?: boolean;
  openPile?: (pile: "draw" | "discard") => void;
  openingDraw?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (clearSelection) setSelected(null);
  }, [clearSelection]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [denial, setDenial] = useState("");
  useEffect(() => {
    if (!denial) return;
    const timer = setTimeout(() => setDenial(""), motionValue("--target-denial-duration"));
    return () => clearTimeout(timer);
  }, [denial]);
  const [remembered, setRemembered] = useState<{ enemy?: string; ally?: string }>({});
  const board = useRef<HTMLElement>(null);
  const [line, setLine] = useState("");
  const focusAfterCommand = useRef<number | null>(null);
  const battle = game.battle!;
  const visibleHand = battle.hand.filter((id) =>
    game.team.some((c) => c.health > 0 && c.id === game.cards.find((card) => card.id === id)?.ownerId),
  );
  const card = game.cards.find((c) => c.id === selected),
    def = card ? definition(card.definitionId) : null;
  const enemyTarget = def?.effect === "attack",
    allyTarget = def?.effect === "heal" || def?.effect === "guard";
  const targets = enemyTarget
    ? battle.enemies.filter((e) => e.health > 0).map((e) => e.id)
    : allyTarget
      ? game.team.filter((c) => c.health > 0).map((c) => c.id)
      : [];
  const last = enemyTarget ? remembered.enemy : remembered.ally;
  const navigationTarget = targets.includes(last ?? "") ? last : targets[0];
  const target = navigateFocus ? navigationTarget : targets.includes(hovered ?? "") ? hovered! : undefined;
  const setTarget = (id: string) => {
    setHovered(id);
    const side = enemyTarget ? "enemy" : "ally";
    setRemembered((old) => (old[side] === id ? old : { ...old, [side]: id }));
  };
  const teamTarget = def?.effect === "teamGuard";
  const preview = useMemo(
    () => (selected && (target || teamTarget) ? previewPlay(game, selected, target) : null),
    [game, selected, target, teamTarget],
  );
  const affected = new Set(
    preview?.events.flatMap((event) => (event.targetId ? [event.targetId] : [])) ?? [],
  );
  if (preview?.accepted) {
    for (const unit of [...game.team, ...battle.enemies]) {
      const next = [...preview.state.team, ...(preview.state.battle?.enemies ?? [])].find(
        (candidate) => candidate.id === unit.id,
      );
      if (
        next &&
        (next.health !== unit.health ||
          next.block !== unit.block ||
          JSON.stringify(combatStatuses(next.combat)) !== JSON.stringify(combatStatuses(unit.combat)))
      )
        affected.add(unit.id);
    }
  }
  if (target) affected.add(target);
  if (def?.effect === "teamGuard")
    game.team.filter((unit) => unit.health > 0).forEach((unit) => affected.add(unit.id));
  const allyRecipient = game.team.find((unit) => unit.id === target);
  const recipient =
    battle.enemies.find((unit) => unit.id === target)?.name ??
    (allyRecipient ? species(allyRecipient.species).name : undefined);
  const play = (command: Command) => {
    if (!send(command)) return;
    setSelected(null);
    setHovered(null);
    setDenial("");
    focusAfterCommand.current = navigateFocus ? Math.max(0, visibleHand.indexOf(selected ?? "")) : null;
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
    controls.current = handle;
    return () => {
      controls.current = null;
    };
  });
  useLayoutEffect(() => {
    if (!selected || !navigateFocus) return;
    board.current
      ?.querySelector<HTMLElement>(target ? `[data-actor-id="${target}"] .creature-card` : ".confirm-play")
      ?.focus();
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
      <section className="enemy-row" aria-label="Enemy row">
        {battle.enemies.map((enemy) => (
          <EnemyCard
            key={enemy.id}
            enemy={enemy}
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
              } else inspect({ species: enemy.species, enemyId: enemy.id });
            }}
            onInspect={() => inspect({ species: enemy.species, enemyId: enemy.id })}
            label={
              selected && enemyTarget && enemy.health > 0 ? `Target ${enemy.name}` : `Inspect ${enemy.name}`
            }
          />
        ))}
      </section>
      <section className="player-row" aria-label="Player row">
        {game.team.map((creature) => (
          <AllyCard
            progression={game}
            key={creature.id}
            creature={creature}
            tooltips={!selected}
            acting={card?.ownerId === creature.id}
            validTarget={!!selected && creature.health > 0 && (allyTarget || def?.effect === "teamGuard")}
            activeTarget={
              !!selected && creature.health > 0 && (target === creature.id || def?.effect === "teamGuard")
            }
            onPreviewEnd={() => setHovered((old) => (old === creature.id ? null : old))}
            invalidTarget={
              !!selected && ((!allyTarget && def?.effect !== "teamGuard") || creature.health <= 0)
            }
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
              } else inspect({ species: creature.species, creatureId: creature.id });
            }}
            onInspect={() => inspect({ species: creature.species, creatureId: creature.id })}
            label={
              selected && allyTarget && creature.health > 0
                ? `Target ${species(creature.species).name}`
                : `Inspect ${species(creature.species).name}`
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
                {recipient ??
                  (def.effect === "teamGuard"
                    ? "All allies"
                    : enemyTarget
                      ? "Choose an enemy"
                      : "Choose an ally")}
              </p>
              <ActionDetails
                compact
                card={card}
                ownerName={species(def.species).name}
                actor={game.team.find((unit) => unit.id === card.ownerId)}
                modifiers={game}
              />
              {preview?.events
                .filter((event) => event.kind === "status" && !event.targetId)
                .map((event, index) => (
                  <p key={index}>{event.text}</p>
                ))}
            </>
          ) : null}
        </div>
        {selected ? (
          <>
            {def?.effect === "teamGuard" ? (
              <Button className="confirm-play" onClick={() => play({ type: "play", cardId: selected })}>
                Play · {controller ? "A" : "Enter"}
              </Button>
            ) : null}
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
          </>
        ) : null}
      </div>
      <HandMotion revision={game.revision} turn={battle.turn} opening={openingDraw} paused={clearSelection}>
        <section className="hand-toolbar" aria-label="Battle cards and controls">
          <div className="battle-dock" data-nav-row>
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
                      onInspect={() => inspect({ card })}
                      onClick={() => {
                        onManualStart?.();
                        setHovered(null);
                        setDenial("");
                        setSelected((old) => (old === id ? null : id));
                      }}
                    />
                  </FanSlot>
                );
              })}
            </div>
          </section>
          <div className="battle-dock" data-nav-row>
            <div className="battle-actions">
              {actions}
              <Button className="end-turn" onClick={() => play({ type: "endTurn" })}>
                End turn{controller ? " · Y" : ""}
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
