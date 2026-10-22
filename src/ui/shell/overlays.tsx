import type { RefObject } from "react";
import type { Session } from "../../application/session";
import type { GameState, Command } from "../../game/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { OwnedBoons } from "../expedition/owned-boons";
import { ReplacementPicker } from "../shared/cards/roster-picker";
import { pendingReplacement } from "../../game/team";
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
  const replacement = pendingReplacement(game);
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
          className="deck-dialog"
          closeLabel={
            modal === "draw"
              ? "Close draw pile"
              : modal === "discard"
                ? "Close discard pile"
                : modal === "deck"
                  ? "Close deck"
                  : "Close Boons"
          }
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!menu) returnFocus(modalOpener.current);
          }}
        >
          <DialogTitle>
            {modal === "draw"
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
          {modal === "deck" || modal === "draw" || modal === "discard" ? (
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
      {replacement && route === "play" && !menu && !modal && !inspection ? (
        <Dialog key={replacement.id} open>
          <DialogContent
            className="swap-dialog"
            showCloseButton={false}
            onOpenAutoFocus={(event) => {
              const first = document.querySelector<HTMLElement>('.swap-dialog [aria-label="Backup"] button');
              if (first) {
                event.preventDefault();
                first.focus();
              }
            }}
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (pendingReplacement(session.store.getState().game)) return;
              returnFocus(
                document.querySelector<HTMLElement>(
                  ".app:not([inert]) .hand .action-card, .app:not([inert]) .end-turn",
                ),
              );
            }}
          >
            <DialogTitle>Choose a replacement</DialogTitle>
            <DialogDescription className="sr-only">
              Choose a living backup for your knocked-out creature
            </DialogDescription>
            <ReplacementPicker key={replacement.id} game={game} outgoing={replacement} send={send} />
          </DialogContent>
        </Dialog>
      ) : null}
      {!modal && inspection ? (
        <Inspector
          item={inspection}
          session={session}
          controls={inspectionControls}
          onClose={() => setInspection(null)}
        />
      ) : null}
    </>
  );
}
