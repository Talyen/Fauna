import { Screen, ScreenHeading } from "./screen";
import { useLayoutEffect, useRef } from "react";
import type { Command, GameState } from "../game/types";
import { canVisitMerchant } from "../game/support";
import { BOONS } from "../game/progression";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { ArtCard } from "./art-card";
import { KeywordText } from "./keyword-text";
import { assetUrl } from "./assets";

export function SupportOffer({ game, send }: { game: GameState; send: (c: Command) => boolean }) {
  const visit = game.support;
  if (!visit || !canVisitMerchant(game)) return null;
  return (
    <div className="destination-option">
      <ArtCard
        aspect="creature"
        artwork={assetUrl("location.silken-clearing")}
        aria-label="Visit Merchant"
        onClick={() => send({ type: "enterSupport", visit: visit.id })}
      />
      <h2>Merchant</h2>
    </div>
  );
}

export function SupportScreen({ game, send }: { game: GameState; send: (c: Command) => boolean }) {
  const visit = game.support!;
  const leave = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (visit.resolved && document.documentElement.dataset.input !== "pointer") leave.current?.focus();
  }, [visit.resolved]);
  return (
    <Screen className="campfire-screen merchant-screen">
      <header className="merchant-heading">
        <ScreenHeading back={() => send({ type: "leaveSupport", visit: visit.id })}>Merchant</ScreenHeading>
        <p className="merchant-wallet">Gold: {game.currency}</p>
      </header>
      <p className="merchant-terms">One purchase per visit · Boons last for this journey</p>
      <section className="boon-options merchant-stock" aria-label="Merchant stock" data-nav-row>
        {visit.stock.map((slot) => {
          const boon = BOONS.find((b) => b.id === slot.boon)!;
          const owned = visit.purchased === boon.id;
          const unavailable = visit.resolved || game.currency < slot.price;
          const reason = owned
            ? "Owned"
            : visit.resolved
              ? "Purchase used"
              : game.currency < slot.price
                ? "Not enough Gold"
                : "";
          const statusId = `merchant-${slot.slot}-status`;
          return (
            <section className="reward-option merchant-offer" key={slot.slot}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ArtCard
                    aspect="action"
                    artwork={assetUrl(`boon.${boon.id}`)}
                    aria-label={`Inspect ${boon.name}`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <strong>{boon.name}</strong>
                  <p>
                    <KeywordText text={boon.text} />
                  </p>
                  {reason ? <p>{reason}</p> : null}
                </TooltipContent>
              </Tooltip>
              <Button
                aria-disabled={unavailable}
                aria-describedby={reason ? statusId : undefined}
                onClick={() => {
                  if (!unavailable) send({ type: "buyBoon", visit: visit.id, slot: slot.slot });
                }}
              >
                {owned ? "Owned" : `Buy · ${slot.price} Gold`}
              </Button>
              <p className="merchant-status" id={statusId}>
                {reason || "\u00a0"}
              </p>
            </section>
          );
        })}
      </section>
      <Button ref={leave} variant="outline" onClick={() => send({ type: "leaveSupport", visit: visit.id })}>
        Leave
      </Button>
    </Screen>
  );
}
