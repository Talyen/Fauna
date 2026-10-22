import { pendingReplacement } from "../../game/team";
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
  setInspection: (value: Inspection | null) => void;
  setModal: (value: Modal) => void;
  setMenu: (value: boolean) => void;
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
    setInspection,
    setModal,
    setMenu,
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
  if (route === "collection" && collectionControls.current?.(action)) return;
  if (action === "back") {
    if (route === "play" && pendingReplacement(game) && !inspection && !modal && !menu) return;
    if (inspection) {
      setInspection(null);
      return;
    }
    if (modal) {
      setModal(null);
      return;
    }
    if (menu) {
      setMenu(false);
      return;
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
    if (card) setInspection({ card });
    else if (kind)
      setInspection({
        species: kind,
        enemyId: focused?.closest<HTMLElement>("[data-enemy-id]")?.dataset.enemyId,
        creatureId: focused?.closest<HTMLElement>("[data-actor-id]")?.dataset.actorId,
      });
    return;
  }
  if (!paused) gameControls.current?.(action);
}
