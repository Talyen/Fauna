import { useEffect, useLayoutEffect, useReducer, useRef, useState, type RefObject } from "react";
import { battlefield } from "../../game/battlefield";
import { drawableOwnerIds } from "../../game/card-actors";
import { chosenRecipients } from "../../game/play-queries";
import { cardTargeting } from "../../game/card-rules";
import { definition, species } from "../../game/content";
import type { BattleState, Command } from "../../game/types";
import { returnFocus } from "../shared/navigation/focus";
import type { Controls, InputAction } from "../shared/navigation/input";
import { motionValue } from "../shared/motion-values";

interface Selection {
  selected: string | null;
  hovered: string | null;
  denial: string;
  remembered: { enemy?: string; ally?: string };
}
type SelectionAction =
  | { type: "choose"; id: string }
  | { type: "target"; id: string; side: "enemy" | "ally" }
  | { type: "leave"; id: string }
  | { type: "denial"; message: string }
  | { type: "prepare" | "clear" | "cancel" | "played" };
const initial: Selection = { selected: null, hovered: null, denial: "", remembered: {} };

function selection(state: Selection, action: SelectionAction): Selection {
  switch (action.type) {
    case "choose":
      return {
        ...state,
        selected: state.selected === action.id ? null : action.id,
        hovered: null,
        denial: "",
      };
    case "target":
      if (state.hovered === action.id && state.remembered[action.side] === action.id) return state;
      return {
        ...state,
        hovered: action.id,
        remembered:
          state.remembered[action.side] === action.id
            ? state.remembered
            : { ...state.remembered, [action.side]: action.id },
      };
    case "leave":
      return state.hovered === action.id ? { ...state, hovered: null } : state;
    case "denial":
      return { ...state, denial: action.message };
    case "prepare":
      return { ...state, hovered: null, denial: "" };
    case "clear":
      return { ...state, selected: null };
    case "cancel":
      return { ...state, selected: null, hovered: null };
    case "played":
      return { ...state, selected: null, hovered: null, denial: "" };
  }
}

/** Transient selection owns no gameplay state; every play still enters the session command boundary. */
export function useBattleInteraction({
  game,
  send,
  controls: controlsRef,
  navigateFocus,
  clearSelection,
  board,
}: {
  game: BattleState;
  send: (command: Command) => boolean;
  controls: Controls;
  navigateFocus: boolean;
  clearSelection: boolean;
  board: RefObject<HTMLElement | null>;
}) {
  const [state, update] = useReducer(selection, initial);
  const { selected, hovered, denial, remembered } = state;
  const [previousClear, setPreviousClear] = useState(clearSelection);
  if (previousClear !== clearSelection) {
    setPreviousClear(clearSelection);
    if (clearSelection) update({ type: "clear" });
  }
  useEffect(() => {
    if (!denial) return;
    const timer = setTimeout(
      () => update({ type: "denial", message: "" }),
      motionValue("--target-denial-duration"),
    );
    return () => clearTimeout(timer);
  }, [denial]);

  const focusAfterCommand = useRef<number | null>(null);
  const enemyRow = battlefield(game, "enemy"),
    playerRow = battlefield(game, "player");
  const drawable = drawableOwnerIds(game);
  const visibleHand = game.battle.hand.filter((id) => {
    const ownerId = game.cards.find((card) => card.id === id)!.ownerId;
    return ownerId === null || drawable.has(ownerId);
  });
  const card = game.cards.find((entry) => entry.id === selected);
  const def = card ? definition(card.definitionId) : null;
  const mode = def ? cardTargeting(def) : "automatic";
  const enemyTarget = mode === "enemy",
    allyTarget = mode === "ally";
  const row = enemyTarget
    ? enemyRow
    : def?.effect === "resurrect"
      ? [...playerRow, ...game.reserves]
      : playerRow;
  // Visual order belongs to the UI; filter legal recipients after ordering the complete row.
  const ordered =
    row.length > 1 &&
    (enemyTarget ? game.battle.enemies : game.team).some((unit) => species(unit.species).legendary)
      ? [row[1]!, row[0]!, ...row.slice(2)]
      : row;
  const legal = new Set(def ? chosenRecipients(game, def).map((unit) => unit.id) : []);
  const targets = ordered.filter((unit) => legal.has(unit.id)).map((unit) => unit.id);
  const last = enemyTarget ? remembered.enemy : remembered.ally;
  const navigationTarget = targets.includes(last ?? "") ? last : targets[0];
  const target = navigateFocus ? navigationTarget : targets.includes(hovered ?? "") ? hovered! : undefined;
  const setTarget = (id: string) => update({ type: "target", id, side: enemyTarget ? "enemy" : "ally" });

  const play = (command: Command) => {
    if (!send(command)) return;
    update({ type: "played" });
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
  }, [game.revision, selected, board]);
  const cancel = () => {
    const opener = board.current?.querySelector<HTMLElement>(`[data-card-id="${selected}"]`) ?? null;
    update({ type: "cancel" });
    if (navigateFocus) returnFocus(opener);
  };
  useEffect(() => {
    const root = board.current;
    const clear = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        !(event.target instanceof Element) ||
        event.target.closest("button, a, input, [role=dialog], [role=tooltip]")
      )
        return;
      update({ type: "clear" });
    };
    root?.addEventListener("pointerdown", clear);
    return () => root?.removeEventListener("pointerdown", clear);
  }, [board]);
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
      board.current
        ?.querySelector<HTMLElement>(
          `[data-actor-id="${next}"] .creature-card, [data-resurrection-target="${next}"]`,
        )
        ?.focus();
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
    if (selected && target && navigateFocus)
      board.current
        ?.querySelector<HTMLElement>(
          `[data-actor-id="${target}"] .creature-card, [data-resurrection-target="${target}"]`,
        )
        ?.focus();
  }, [selected, target, navigateFocus, board]);

  const chooseCard = (cardId: string) => {
    const chosen = game.cards.find((entry) => entry.id === cardId)!;
    const mode = cardTargeting(definition(chosen.definitionId));
    if (mode === "enemy" || mode === "ally") update({ type: "choose", id: cardId });
    else {
      update({ type: "prepare" });
      play({ type: "play", cardId });
    }
  };
  return {
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
    legalTargets: legal,
    setTarget,
    leaveTarget: (id: string) => update({ type: "leave", id }),
    deny: (message: string) => update({ type: "denial", message }),
    chooseCard,
    play,
    cancel,
  };
}
