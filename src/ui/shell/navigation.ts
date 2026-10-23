import type { MenuPage } from "../menu/menu-actions";
import type { Inspection } from "../shared/inspection-model";
import type { Modal } from "./types";

type Page = { route: "home" | "play" } | { route: MenuPage; returnTo: "home" | "pause" };
type Overlay =
  | { kind: "none" }
  | { kind: "pause" }
  | { kind: "inspection"; item: Inspection; parent: "pause" | "page" }
  | { kind: "dialog"; modal: NonNullable<Modal>; parent: "pause" | "page"; inspection: Inspection | null };
export interface ShellNavigation {
  page: Page;
  overlay: Overlay;
  menuInstance: number;
  modalInstance: number;
}
export const initialNavigation: ShellNavigation = {
  page: { route: "home" },
  overlay: { kind: "none" },
  menuInstance: 0,
  modalInstance: 0,
};
export type NavigationAction =
  | { type: "play" | "home" | "externalBlock" | "closePause" | "closeDialog" | "closeInspection" }
  | { type: "openPause" | "backFromPage"; instance: number }
  | { type: "openMenuPage"; page: MenuPage }
  | { type: "openDialog"; modal: NonNullable<Modal> }
  | { type: "inspect"; item: Inspection };

export function shellNavigation(state: ShellNavigation, action: NavigationAction): ShellNavigation {
  const { overlay } = state;
  switch (action.type) {
    case "play":
    case "home":
      return { ...state, page: { route: action.type }, overlay: { kind: "none" } };
    case "externalBlock":
      return { ...state, overlay: { kind: "none" } };
    case "openPause":
      return {
        ...state,
        overlay:
          overlay.kind === "dialog" || overlay.kind === "inspection"
            ? { ...overlay, parent: "pause" }
            : { kind: "pause" },
        menuInstance: action.instance,
      };
    case "closePause":
      return overlay.kind === "pause" ? { ...state, overlay: { kind: "none" } } : state;
    case "openMenuPage":
      return {
        ...state,
        page: { route: action.page, returnTo: overlay.kind === "pause" ? "pause" : "home" },
        overlay: { kind: "none" },
      };
    case "backFromPage":
      if (!("returnTo" in state.page)) return state;
      return {
        ...state,
        page: { route: state.page.returnTo === "pause" ? "play" : "home" },
        overlay: { kind: state.page.returnTo === "pause" ? "pause" : "none" },
        menuInstance: action.instance,
      };
    case "openDialog":
      return {
        ...state,
        overlay: {
          kind: "dialog",
          modal: action.modal,
          parent: overlay.kind === "pause" ? "pause" : "page",
          inspection: null,
        },
        modalInstance: state.modalInstance + 1,
      };
    case "closeDialog":
      return overlay.kind === "dialog"
        ? { ...state, overlay: { kind: overlay.parent === "pause" ? "pause" : "none" } }
        : state;
    case "inspect":
      return {
        ...state,
        overlay:
          overlay.kind === "dialog"
            ? { ...overlay, inspection: action.item }
            : { kind: "inspection", item: action.item, parent: overlay.kind === "pause" ? "pause" : "page" },
      };
    case "closeInspection":
      return overlay.kind === "dialog"
        ? { ...state, overlay: { ...overlay, inspection: null } }
        : overlay.kind === "inspection"
          ? { ...state, overlay: { kind: overlay.parent === "pause" ? "pause" : "none" } }
          : state;
  }
}

/** Rendering, input, effects and Auto-play share this single precedence decision. */
export function activeSurface(state: ShellNavigation, replacement: boolean, blocked = false) {
  const { overlay, page } = state;
  const modal = overlay.kind === "dialog" ? overlay.modal : null;
  const inspection =
    overlay.kind === "inspection" ? overlay.item : overlay.kind === "dialog" ? overlay.inspection : null;
  const menu =
    overlay.kind === "pause" ||
    ((overlay.kind === "dialog" || overlay.kind === "inspection") && overlay.parent === "pause");
  const top = inspection
    ? "inspection"
    : modal
      ? "dialog"
      : menu
        ? "pause"
        : replacement && page.route === "play"
          ? "replacement"
          : "page";
  return {
    top,
    modal,
    inspection,
    menu,
    scope:
      top === "inspection"
        ? "inspection"
        : (modal ?? (top === "pause" ? "menu" : top === "replacement" ? "replacement" : page.route)),
    paused: blocked || replacement || page.route !== "play" || top !== "page",
    clearSelection: blocked || replacement || overlay.kind !== "none",
  };
}

export type ShellSurface = ReturnType<typeof activeSurface>["top"];
