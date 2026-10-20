import { useLayoutEffect, useRef } from "react";
import type { Command, GameState } from "../game/types";
import { BOONS } from "../game/progression";
import { species } from "../game/content";
import { SPRING_CURRENCY, springRecovery, supportTitle } from "../game/support";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { ArtCard } from "./art-card";
import { AllyCard } from "./cards";
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
  if (!v || v.resolved) return null;
  const title = supportTitle(v.kind);
  return (
    <div className="destination-option">
      <ArtCard
        aspect="creature"
        artwork={assetUrl(v.kind === "merchant" ? "location.silken-clearing" : "location.mossy-stream")}
        data-support={v.id}
        aria-label={`Inspect ${title}`}
        onClick={() => inspect({ support: v.id })}
        onContextMenu={(event) => {
          event.preventDefault();
          inspect({ support: v.id });
        }}
      />
      <h2>{title}</h2>
      <p>{v.kind === "merchant" ? "Shop" : "Event"}</p>
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
  if (!v || v.resolved) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <DialogTitle>{supportTitle(v.kind)}</DialogTitle>
        <DialogDescription>
          {v.kind === "merchant"
            ? "Buy one Boon for this journey. Spending uses permanent currency."
            : "Restore roster Health or take currency."}
        </DialogDescription>
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
  const all = [...game.team, ...game.reserves];
  return (
    <main className="campfire-screen">
      <h1>{supportTitle(v.kind)}</h1>
      {v.kind === "merchant" ? (
        <>
          <p>Currency: {game.currency} · One purchase per visit · Boons last for this journey</p>
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
                    {v.purchased === boon.id ? "Owned" : `Buy · ${slot.price} currency`}
                  </Button>
                </section>
              );
            })}
          </section>
        </>
      ) : (
        <>
          <section className="campfire-roster" aria-label="Spring recovery">
            {all.map((c) => (
              <div key={c.id}>
                <AllyCard creature={c} presentation />
                <h2>{species(c.species).name}</h2>
                <p>
                  {c.health}/{species(c.species).health} Health · Recover +{springRecovery(c)}
                </p>
              </div>
            ))}
          </section>
          <div className="selection-footer" data-nav-row>
            <Button
              disabled={v.resolved || !all.some((c) => springRecovery(c) > 0)}
              onClick={() => send({ type: "springChoice", visit: v.id, choice: "heal" })}
            >
              Restore Health
            </Button>
            <Button
              disabled={v.resolved || game.currency >= 1_000_000}
              onClick={() => send({ type: "springChoice", visit: v.id, choice: "currency" })}
            >
              Take {Math.min(SPRING_CURRENCY, 1_000_000 - game.currency)} currency
            </Button>
          </div>
        </>
      )}
      <Button ref={leave} variant="outline" onClick={() => send({ type: "leaveSupport", visit: v.id })}>
        Leave
      </Button>
    </main>
  );
}
