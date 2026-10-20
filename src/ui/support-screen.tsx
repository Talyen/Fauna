import { useLayoutEffect, useRef } from "react";
import type { Command, GameState } from "../game/types";
import { canVisitMerchant } from "../game/support";
import { BOONS } from "../game/progression";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { ArtCard } from "./art-card";
import { KeywordText } from "./keyword-text";
import { assetUrl } from "./assets";
export function SupportOffer({
  game,
  inspect,
}: {
  game: GameState;
  inspect: (item: { support: string }) => void;
}) {
  const v = game.support;
  if (!v || !canVisitMerchant(game)) return null;
  const title = "Merchant";
  return (
    <div className="destination-option">
      <ArtCard
        aspect="creature"
        artwork={assetUrl("location.silken-clearing")}
        data-support={v.id}
        aria-label={`Inspect ${title}`}
        onClick={() => inspect({ support: v.id })}
        onContextMenu={(event) => {
          event.preventDefault();
          inspect({ support: v.id });
        }}
      />
      <h2>{title}</h2>
      <p>Shop</p>
    </div>
  );
}
export function SupportInspector({
  game,
  send,
  close,
}: {
  game: GameState;
  send: (c: Command) => boolean;
  close: () => void;
}) {
  const v = game.support;
  if (!v || !canVisitMerchant(game)) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <DialogTitle>Merchant</DialogTitle>
        <DialogDescription>Buy one Boon for this journey. Spending uses permanent Gold.</DialogDescription>
        <Button
          onClick={() => {
            if (send({ type: "enterSupport", visit: v.id })) close();
          }}
        >
          Enter
        </Button>
      </DialogContent>
    </Dialog>
  );
}
export function SupportScreen({ game, send }: { game: GameState; send: (c: Command) => boolean }) {
  const v = game.support!;
  const leave = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (v.resolved && document.documentElement.dataset.input !== "pointer") leave.current?.focus();
  }, [v.resolved]);
  return (
    <main className="campfire-screen">
      <h1>Merchant</h1>
      <p>Gold: {game.currency} · One purchase per visit · Boons last for this journey</p>
      <section className="boon-options" aria-label="Merchant stock" data-nav-row>
        {v.stock.map((slot) => {
          const boon = BOONS.find((b) => b.id === slot.boon)!;
          return (
            <section className="reward-option" key={slot.slot}>
              <ArtCard
                aspect="action"
                artwork={assetUrl(`boon.${boon.id}`)}
                presentation
                aria-label={boon.name}
              />
              <h2>{boon.name}</h2>
              <p>
                <KeywordText text={boon.text} />
              </p>
              <Button
                disabled={v.resolved || game.currency < slot.price}
                onClick={() => send({ type: "buyBoon", visit: v.id, slot: slot.slot })}
              >
                {v.purchased === boon.id ? "Owned" : `Buy · ${slot.price} Gold`}
              </Button>
            </section>
          );
        })}
      </section>
      <Button ref={leave} variant="outline" onClick={() => send({ type: "leaveSupport", visit: v.id })}>
        Leave
      </Button>
    </main>
  );
}
