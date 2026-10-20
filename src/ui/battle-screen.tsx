import { useCallback, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
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
export type Inspection = { card: Card } | { species: GameState["selected"][number]; enemyId?: string };
export type Controls = MutableRefObject<((action: InputAction) => boolean) | null>;
function FanSlot({ index, count, children }: { index: number; count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const offset = index - (count - 1) / 2,
      angle = offset * 4,
      radians = (angle * Math.PI) / 180;
    const scale = 1 / (Math.cos(radians) + 0.75 * Math.abs(Math.sin(radians)));
    const style = ref.current!.style;
    style.setProperty("--fan-angle", `${angle}deg`);
    style.setProperty("--fan-fit", String(scale));
    style.setProperty("--fan-drop", `${Math.abs(offset) * 7}px`);
    style.setProperty("--fan-order", String(index));
  }, [index, count]);
  return (
    <div className="hand-slot" ref={ref}>
      {children}
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
}: {
  game: GameState;
  send: (command: Command) => boolean;
  inspect: (item: Inspection) => void;
  controls: Controls;
  bursts: readonly Burst[];
  controller: boolean;
  navigateFocus: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<{ enemy?: string; ally?: string }>({});
  const board = useRef<HTMLElement>(null);
  const [line, setLine] = useState("");
  const focusAfterCommand = useRef(false);
  const battle = game.battle!;
  const card = game.cards.find((c) => c.id === selected),
    def = card ? definition(card.definitionId) : null;
  const enemyTarget = def?.effect === "attack" || def?.effect === "mark",
    allyTarget = def?.effect === "heal" || def?.effect === "guard";
  const targets = enemyTarget
    ? battle.enemies.filter((e) => e.health > 0).map((e) => e.id)
    : allyTarget
      ? game.team.filter((c) => c.health > 0).map((c) => c.id)
      : [];
  const last = enemyTarget ? remembered.enemy : remembered.ally;
  const target = targets.includes(last ?? "") ? last : targets[0];
  const setTarget = (id: string) =>
    setRemembered((old) => ({ ...old, [id.startsWith("enemy-") ? "enemy" : "ally"]: id }));
  const preview = selected ? previewPlay(game, selected, target) : null;
  const play = (command: Command) => {
    if (!send(command)) return;
    setSelected(null);
    focusAfterCommand.current = navigateFocus;
  };
  useLayoutEffect(() => {
    if (focusAfterCommand.current && !selected) {
      focusAfterCommand.current = false;
      returnFocus(
        board.current?.querySelector<HTMLElement>('.hand .action-card:not([aria-disabled="true"])') ?? null,
      );
    }
  }, [game.revision, selected]);
  const cancel = useCallback(() => {
    const opener = board.current?.querySelector<HTMLElement>(`[data-card-id="${selected}"]`) ?? null;
    setSelected(null);
    returnFocus(opener);
  }, [selected]);
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
      setTarget(
        targets[(targets.indexOf(target!) + (action === "left" ? -1 : 1) + targets.length) % targets.length]!,
      );
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
    if (!selected) return;
    board.current
      ?.querySelector<HTMLElement>(target ? `[data-actor-id="${target}"] .creature-card` : ".confirm-play")
      ?.focus();
  }, [selected, target]);
  useLayoutEffect(() => {
    const update = () => {
      const root = board.current;
      const actor = root?.querySelector(`[data-actor-id="${card?.ownerId}"] .creature-card`);
      const recipient = root?.querySelector(`[data-actor-id="${target}"] .creature-card`);
      if (!root || !actor || !recipient || !selected) {
        setLine("");
        return;
      }
      const origin = root.getBoundingClientRect(),
        a = actor.getBoundingClientRect(),
        b = recipient.getBoundingClientRect();
      const x = a.x + a.width / 2 - origin.x,
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
    return () => observer.disconnect();
  }, [card?.ownerId, selected, target, allyTarget]);
  return (
    <main ref={board} className="battle-screen" aria-label="Battlefield" data-selected-card={selected ?? ""}>
      <section className="enemy-row" aria-label="Enemy row">
        {battle.enemies.map((enemy) => (
          <EnemyCard
            key={enemy.id}
            enemy={enemy}
            tooltips={!selected}
            modifiers={game}
            onPreview={() => {
              if (selected && enemyTarget && enemy.health > 0) setTarget(enemy.id);
            }}
            preview={
              selected && enemyTarget && target === enemy.id ? (
                <TargetPreview before={game} result={preview} targetId={enemy.id} />
              ) : undefined
            }
            feedback={<CombatFeedback bursts={bursts} targetId={enemy.id} />}
            onClick={() => {
              if (selected && enemyTarget && enemy.health > 0)
                play({ type: "play", cardId: selected, targetId: enemy.id });
              else inspect({ species: enemy.species, enemyId: enemy.id });
            }}
            onInspect={() => inspect({ species: enemy.species, enemyId: enemy.id })}
            label={
              selected && enemyTarget && enemy.health > 0 ? `Target ${enemy.name}` : `Inspect ${enemy.name}`
            }
          />
        ))}
      </section>
      <div className="target-control">
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
      <section className="player-row" aria-label="Player row">
        {game.team.map((creature) => (
          <AllyCard
            key={creature.id}
            creature={creature}
            modifiers={game}
            cards={game.cards}
            selected={card?.ownerId === creature.id}
            tooltips={!selected}
            onPreview={() => {
              if (selected && allyTarget && creature.health > 0) setTarget(creature.id);
            }}
            preview={
              selected && ((allyTarget && target === creature.id) || def?.effect === "teamGuard") ? (
                <TargetPreview before={game} result={preview} targetId={creature.id} />
              ) : undefined
            }
            feedback={<CombatFeedback bursts={bursts} targetId={creature.id} />}
            onClick={() => {
              if (selected && allyTarget && creature.health > 0)
                play({ type: "play", cardId: selected, targetId: creature.id });
              else inspect({ species: creature.species });
            }}
            onInspect={() => inspect({ species: creature.species })}
            label={
              selected && allyTarget && creature.health > 0
                ? `Target ${species(creature.species).name}`
                : `Inspect ${species(creature.species).name}`
            }
          />
        ))}
      </section>
      <section className="hand-section" aria-label="Action hand">
        <div className="hand-toolbar">
          <ManaCrystals mana={battle.mana} />
          <Button className="end-turn" onClick={() => play({ type: "endTurn" })}>
            End turn{controller ? " · Y" : ""}
          </Button>
        </div>
        <div className="hand">
          {battle.hand.map((id, index) => {
            const card = game.cards.find((c) => c.id === id)!,
              owner = game.team.find((c) => c.id === card.ownerId)!;
            return (
              <FanSlot key={id} index={index} count={battle.hand.length}>
                <ActionCard
                  card={card}
                  actor={owner}
                  modifiers={game}
                  ownerName={species(owner.species).name}
                  selected={selected === id}
                  disabled={battle.mana < definition(card.definitionId).cost}
                  tooltips={!selected}
                  onInspect={() => inspect({ card })}
                  onClick={() => setSelected((old) => (old === id ? null : id))}
                />
              </FanSlot>
            );
          })}
        </div>
      </section>
      {line ? (
        <svg className="target-line" aria-hidden="true">
          <path d={line} />
        </svg>
      ) : null}
    </main>
  );
}
