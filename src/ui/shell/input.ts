import type { ShellSurface } from "./navigation";
import type { Session } from "../../application/session";
import type { GameState } from "../../game/types";
import type { SpeciesId } from "../../game/content";
import type { Inspection } from "../shared/inspection-model";
import { moveFocus, type Controls, type InputAction } from "../shared/navigation/input";
import { isAvailableFocusTarget } from "../shared/navigation/focus";
import type { Route, Modal } from "./types";
interface ShellInputContext {
  session: Session;
  inspection: Inspection | null;
  inspectionControls: Controls;
  collectionControls: Controls;
  talentControls: Controls;
  gameControls: Controls;
  route: Route;
  modal: Modal;
  menu: boolean;
  paused: boolean;
  game: GameState;
  inspect: (value: Inspection | null) => void;
  closeDialog: () => void;
  closePause: () => void;
  surface: ShellSurface;
  backFromPage: () => void;
  openMenu: () => void;
}
export function routeInput(action: InputAction, context: ShellInputContext) {
  const {
    session,
    inspection,
    inspectionControls,
    route,
    collectionControls,
    modal,
    menu,
    talentControls,
    gameControls,
    paused,
    game,
    inspect,
    closeDialog,
    closePause,
    surface,
    backFromPage,
    openMenu,
  } = context;
  if (session.store.getState().overlayActive) return;
  if (session.store.getState().cloud.blocking) {
    if (["left", "right", "up", "down"].includes(action))
      moveFocus(action as "left" | "right" | "up" | "down");
    else if (action === "confirm") {
      const focused = document.activeElement as HTMLElement | null;
      if (isAvailableFocusTarget(focused)) focused.click();
    }
    return;
  }
  if (inspection && inspectionControls.current?.(action)) return;
  if (!inspection && route === "collection" && collectionControls.current?.(action)) return;
  if (action === "back") {
    switch (surface) {
      case "replacement":
        return;
      case "inspection":
        inspect(null);
        return;
      case "dialog":
        closeDialog();
        return;
      case "pause":
        closePause();
        return;
      case "page":
        break;
    }
    if (route === "talents" && talentControls.current?.(action)) return;
    if (["talents", "collection", "settings", "glossary"].includes(route)) {
      backFromPage();
      return;
    }
    if (route === "play") {
      if (!gameControls.current?.(action)) openMenu();
    }
    return;
  }
  if (["left", "right", "up", "down"].includes(action)) {
    if (!paused && gameControls.current?.(action)) return;
    moveFocus(action as "left" | "right" | "up" | "down");
    return;
  }
  if (action === "confirm") {
    const focused = document.activeElement as HTMLElement | null;
    if (isAvailableFocusTarget(focused)) focused.click();
    return;
  }
  if (
    action === "inspect" &&
    !inspection &&
    route !== "collection" &&
    !(route === "play" && game.phase === "battle") &&
    !menu &&
    (!modal || ["deck", "draw", "discard"].includes(modal))
  ) {
    const focused = document.activeElement as HTMLElement | null;
    const card = game.cards.find(
      (c) => c.id === focused?.closest<HTMLElement>("[data-card-id]")?.dataset.cardId,
    );
    const kind = focused?.closest<HTMLElement>("[data-species]")?.dataset.species as SpeciesId | undefined;
    if (card) inspect({ card });
    else if (kind)
      inspect({
        species: kind,
        enemyId: focused?.closest<HTMLElement>("[data-enemy-id]")?.dataset.enemyId,
        creatureId: focused?.closest<HTMLElement>("[data-actor-id]")?.dataset.actorId,
      });
    return;
  }
  if (!paused) gameControls.current?.(action);
}
