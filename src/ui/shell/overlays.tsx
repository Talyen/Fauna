import type { RefObject } from "react";
import type { Session } from "../../application/session";
import type { GameState, Command } from "../../game/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { OwnedBoons } from "../expedition/owned-boons";
import { RosterPicker } from "../shared/cards/roster-picker";
import { DeckCards } from "../shared/cards/deck-cards";
import { Inspector } from "../inspection/inspection";
import type { Inspection } from "../shared/inspection-model";
import type { Controls } from "../shared/navigation/input";
import { returnFocus } from "../shared/navigation/focus";
import type { Route, Modal } from "./types";
interface ShellOverlaysProps {
  modal: Modal;
  modalInstance: number;
  menu: boolean;
  modalOpener: RefObject<HTMLElement | null>;
  game: GameState;
  send: (command: Command) => boolean;
  setModal: (value: Modal) => void;
  inspection: Inspection | null;
  setInspection: (value: Inspection | null) => void;
  session: Session;
  inspectionControls: Controls;
  route: Route;
}
export function ShellOverlays({
  modal,
  modalInstance,
  menu,
  modalOpener,
  game,
  send,
  setModal,
  inspection,
  setInspection,
  session,
  inspectionControls,
  route,
}: ShellOverlaysProps) {
  return (
    <>
      {" "}
      <Dialog
        key={`modal-${modalInstance}`}
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent
          className={
            modal === "swap" || modal === "lineup"
              ? "swap-dialog"
              : modal === "deck" || modal === "draw" || modal === "discard" || modal === "boons"
                ? "deck-dialog"
                : ""
          }
          closeLabel={
            modal === "swap"
              ? "Close Swap"
              : modal === "lineup"
                ? "Close Lineup"
                : modal === "draw"
                  ? "Close draw pile"
                  : modal === "discard"
                    ? "Close discard pile"
                    : modal === "deck"
                      ? "Close deck"
                      : modal === "boons"
                        ? "Close Boons"
                        : "Close dialog"
          }
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!menu) returnFocus(modalOpener.current);
          }}
        >
          <DialogTitle>
            {modal === "swap"
              ? "Swap"
              : modal === "lineup"
                ? "Lineup"
                : modal === "draw"
                  ? "Draw Pile"
                  : modal === "discard"
                    ? "Discard Pile"
                    : modal === "deck"
                      ? "Deck"
                      : modal === "boons"
                        ? "Boons"
                        : ""}
          </DialogTitle>
          <DialogDescription className="sr-only">Game information and controls</DialogDescription>
          {modal === "swap" || modal === "lineup" ? (
            <RosterPicker
              key={modal}
              game={game}
              lineup={modal === "lineup"}
              send={send}
              inspect={modal === "lineup" ? setInspection : undefined}
              close={() => setModal(null)}
            />
          ) : modal === "deck" || modal === "draw" || modal === "discard" ? (
            <DeckCards
              game={game}
              inspect={game.phase === "battle" ? undefined : setInspection}
              pile={modal === "deck" ? undefined : modal}
            />
          ) : modal === "boons" ? (
            <OwnedBoons boons={game.boons} />
          ) : null}
          {inspection ? (
            <Inspector
              item={inspection}
              session={session}
              controls={inspectionControls}
              onClose={() => setInspection(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {!modal && inspection ? (
        <Inspector
          item={inspection}
          session={session}
          controls={inspectionControls}
          onClose={() => setInspection(null)}
          chooseStarter={
            route === "play" &&
            game.phase === "draft" &&
            !menu &&
            "species" in inspection &&
            game.starterOffers.includes(inspection.species)
              ? () => send({ type: "draft", species: inspection.species })
              : undefined
          }
        />
      ) : null}
    </>
  );
}
