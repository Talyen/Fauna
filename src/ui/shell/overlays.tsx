import { useMessages } from "../shared/localization/message-context";
import type { ShellSurface } from "./navigation";
import { EffectScope } from "../shared/effects/effects";
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
import type { Modal } from "./types";
interface ShellOverlaysProps {
  modal: Modal;
  modalInstance: number;
  menu: boolean;
  modalOpener: RefObject<HTMLElement | null>;
  game: GameState;
  send: (command: Command) => boolean;
  closeDialog: () => void;
  inspection: Inspection | null;
  inspect: (value: Inspection | null) => void;
  session: Session;
  inspectionControls: Controls;
  surface: ShellSurface;
}
export function ShellOverlays({
  modal,
  modalInstance,
  menu,
  modalOpener,
  game,
  send,
  closeDialog,
  inspection,
  inspect,
  session,
  inspectionControls,
  surface,
}: ShellOverlaysProps) {
  const i18n = useMessages();
  const replacement = pendingReplacement(game);
  return (
    <>
      {" "}
      <Dialog
        key={`modal-${modalInstance}`}
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent
          className="deck-dialog"
          closeLabel={
            modal === "draw"
              ? i18n.message("overlay.closeDraw", "Close draw pile")
              : modal === "discard"
                ? i18n.message("overlay.closeDiscard", "Close discard pile")
                : modal === "deck"
                  ? i18n.message("overlay.closeDeck", "Close deck")
                  : i18n.message("overlay.closeBoons", "Close Boons")
          }
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!menu) returnFocus(modalOpener.current);
          }}
        >
          <DialogTitle>
            {modal === "draw"
              ? i18n.message("overlay.drawPile", "Draw Pile")
              : modal === "discard"
                ? i18n.message("overlay.discardPile", "Discard Pile")
                : modal === "deck"
                  ? i18n.message("overlay.deck", "Deck")
                  : modal === "boons"
                    ? i18n.message("overlay.boons", "Boons")
                    : ""}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {i18n.message("overlay.information", "Game information and controls")}
          </DialogDescription>
          <EffectScope name={modal ?? "modal"}>
            {modal === "deck" || modal === "draw" || modal === "discard" ? (
              <DeckCards
                game={game}
                inspect={game.phase === "battle" ? undefined : inspect}
                pile={modal === "deck" ? undefined : modal}
              />
            ) : modal === "boons" ? (
              <OwnedBoons boons={game.boons} />
            ) : null}
          </EffectScope>
          {inspection ? (
            <Inspector
              item={inspection}
              session={session}
              controls={inspectionControls}
              onClose={() => inspect(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {replacement && surface === "replacement" ? (
        <Dialog key={replacement.id} open>
          <DialogContent
            className="swap-dialog"
            data-nav-layout="rows"
            showCloseButton={false}
            onOpenAutoFocus={(event) => {
              const first = document.querySelector<HTMLElement>(
                ".swap-dialog [data-replacement-choices] button",
              );
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
            <DialogTitle>{i18n.message("overlay.replacement", "Choose a replacement")}</DialogTitle>
            <DialogDescription className="sr-only">
              {i18n.message(
                "overlay.replacementHelp",
                "Choose a living backup for your knocked-out creature",
              )}
            </DialogDescription>
            <EffectScope name="replacement">
              <ReplacementPicker key={replacement.id} game={game} outgoing={replacement} send={send} />
            </EffectScope>
          </DialogContent>
        </Dialog>
      ) : null}
      {!modal && inspection ? (
        <Inspector
          item={inspection}
          session={session}
          controls={inspectionControls}
          onClose={() => inspect(null)}
        />
      ) : null}
    </>
  );
}
