import { playTargeting } from "../../game/mending";
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type RefObject } from "react";
import { battlefieldView } from "../../game/battlefield";
import { cardActor, drawableOwnerIds } from "../../game/card-actors";
import { chosenRecipients } from "../../game/play-queries";
import { definition, species } from "../../game/content";
import type { BattleState, Command } from "../../game/types";
import { returnFocus } from "../shared/navigation/focus";
import type { Controls, InputAction } from "../shared/navigation/input";
import { motionValue } from "../shared/motion-values";
import { battlefieldPresentation, orderedTargets, targetElement } from "./battle-targets";

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
  const enemyRow = battlefieldView(game, "enemy"),
    playerRow = battlefieldView(game, "player");
  const drawable = drawableOwnerIds(game);
  const cardsById = new Map<string, (typeof game.cards)[number]>();
  for (const entry of game.cards) if (!cardsById.has(entry.id)) cardsById.set(entry.id, entry);
  const visibleHand = game.battle.hand.filter((id) => {
    const ownerId = cardsById.get(id)!.ownerId;
    return ownerId === null || drawable.has(ownerId);
  });
  const card = selected === null ? undefined : cardsById.get(selected);
  const def = card ? definition(card.definitionId) : null;
  const actor = card ? cardActor(game, card) : undefined;
  const mode = def ? playTargeting(def, game, actor) : "automatic";
  const enemyTarget = mode === "enemy",
    allyTarget = mode === "ally";
  const enemyLegendary = game.battle.enemies.some((unit) => species(unit.species).legendary);
  const playerLegendary = game.team.some((unit) => species(unit.species).legendary);
  const enemyPresentation = battlefieldPresentation(enemyRow, enemyLegendary);
  const playerPresentation = battlefieldPresentation(playerRow, playerLegendary);
  const recipients = def ? chosenRecipients(game, def, actor) : [];
  const legal = new Set(recipients.map((unit) => unit.id));
  const targets = orderedTargets(
    recipients,
    enemyTarget ? enemyPresentation : playerPresentation,
    enemyTarget ? [] : game.reserves,
  );
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
      targetElement(board.current, next)?.focus();
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
    if (selected && target && navigateFocus) targetElement(board.current, target)?.focus();
  }, [selected, target, navigateFocus, board]);

  const chooseCard = (cardId: string) => {
    const chosen = cardsById.get(cardId)!;
    const chosenDef = definition(chosen.definitionId);
    const chosenActor = cardActor(game, chosen);
    const mode = playTargeting(chosenDef, game, chosenActor);
    const recipients =
      mode === "enemy" || mode === "ally" ? chosenRecipients(game, chosenDef, chosenActor) : [];
    if (recipients.length === 1) {
      update({ type: "prepare" });
      play({ type: "play", cardId, targetId: recipients[0]!.id });
    } else if (mode === "enemy" || mode === "ally") update({ type: "choose", id: cardId });
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
    enemyLegendary,
    playerLegendary,
    enemyPresentation,
    playerPresentation,
    visibleHand,
    cardsById,
    legalTargets: legal,
    setTarget,
    leaveTarget: (id: string) => update({ type: "leave", id }),
    deny: (message: string) => update({ type: "denial", message }),
    chooseCard,
    play,
    cancel,
  };
}
