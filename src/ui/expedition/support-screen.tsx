import { useMessages } from "../shared/localization/message-context";
import { visualKeywords } from "../shared/effects/palettes";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { useLayoutEffect, useRef } from "react";
import { Coins } from "lucide-react";
import type { Command, GameState, StateAt } from "../../game/types";
import { canVisitMerchant } from "../../game/destinations";
import { findBoon } from "../../game/content";
import { EffectButton as Button } from "../shared/effects/treatments";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { ArtCard } from "../shared/cards/art-card";
import { assetUrl } from "../shared/assets";
import { BoonArt, BoonName, BoonText } from "./boon-presentation";
export function SupportOffer({ game, send }: { game: GameState; send: (c: Command) => boolean }) {
  const i18n = useMessages();
  const visit = game.support;
  if (!visit || !canVisitMerchant(game)) return null;
  return (
    <div className="destination-option">
      <ArtCard
        aspect="creature"
        artwork={assetUrl("location.silken-clearing")}
        effectTone="gold"
        aria-label={i18n.message("merchant.visit", "Visit Boon Merchant")}
        onClick={() => send({ type: "enterSupport", visit: visit.id })}
      />
      <h2>{i18n.message("merchant.name", "Boon Merchant")}</h2>
    </div>
  );
}

export function SupportScreen({ game, send }: { game: StateAt<"support">; send: (c: Command) => boolean }) {
  const i18n = useMessages();
  const visit = game.support;
  const purchased = findBoon(visit.purchased);
  const leave = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (visit.purchased && document.documentElement.dataset.input !== "pointer") leave.current?.focus();
  }, [visit.purchased]);
  const finish = () => send({ type: "leaveSupport", visit: visit.id });
  return (
    <Screen className="campfire-screen merchant-screen">
      <header className="merchant-heading">
        <ScreenHeading
          back={finish}
          trailing={
            !purchased ? (
              <p className="merchant-wallet">
                <Coins className="gold-icon" aria-hidden="true" />
                {i18n.message("merchant.gold", "{{amount}} Gold", { amount: game.currency })}
              </p>
            ) : undefined
          }
        >
          {purchased
            ? i18n.message("merchant.received", "Boon received")
            : i18n.message("merchant.name", "Boon Merchant")}
        </ScreenHeading>
      </header>
      {purchased ? (
        <section
          className="merchant-reward"
          aria-label={i18n.message("merchant.purchasedBoon", "Purchased Boon")}
        >
          <BoonArt
            boon={purchased}
            presentation
            aria-label={i18n.content(`content.boon.${purchased.id}.name`, purchased.name)}
          />
          <h2>
            <BoonName boon={purchased} />
          </h2>
          <BoonText boon={purchased} />
          <p className="merchant-terms">{i18n.message("merchant.forJourney", "For this journey")}</p>
        </section>
      ) : (
        <>
          <p className="merchant-terms merchant-policy">
            <em>{i18n.message("merchant.policy", "Limit 1 per customer - No Refunds!")}</em>
          </p>
          <section
            className="boon-options merchant-stock"
            aria-label={i18n.message("merchant.stock", "Boon Merchant stock")}
            data-nav-row
          >
            {visit.stock.map((slot) => {
              const boon = findBoon(slot.boon)!;
              const unavailable = visit.resolved || game.currency < slot.price;
              const reason = visit.resolved
                ? i18n.message("merchant.purchaseUsed", "Purchase used")
                : game.currency < slot.price
                  ? i18n.message("merchant.notEnough", "Not enough Gold")
                  : "";
              const statusId = `merchant-${slot.slot}-status`;
              return (
                <section className="reward-option merchant-offer" key={slot.slot}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <BoonArt
                        boon={boon}
                        aria-label={i18n.message("boons.inspect", "Inspect {{name}}", {
                          name: i18n.content(`content.boon.${boon.id}.name`, boon.name),
                        })}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <strong>
                        <BoonName boon={boon} />
                      </strong>
                      <BoonText boon={boon} />
                      <p>{i18n.message("merchant.forJourney", "For this journey")}</p>
                      {reason ? <p>{reason}</p> : null}
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    effectKeywords={visualKeywords(boon.text)}
                    variant="secondary"
                    className="merchant-price"
                    aria-label={i18n.message("merchant.buy", "Buy {{name}} for {{amount}} Gold", {
                      name: i18n.content(`content.boon.${boon.id}.name`, boon.name),
                      amount: slot.price,
                    })}
                    aria-disabled={unavailable}
                    aria-describedby={reason ? statusId : undefined}
                    onClick={() => {
                      if (!unavailable) send({ type: "buyBoon", visit: visit.id, slot: slot.slot });
                    }}
                  >
                    <Coins className="gold-icon" aria-hidden="true" />
                    {i18n.message("merchant.gold", "{{amount}} Gold", { amount: slot.price })}
                  </Button>
                  {reason ? (
                    <p className="merchant-status" id={statusId}>
                      {reason}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </section>
        </>
      )}
      <Button ref={leave} variant="outline" className="merchant-leave" onClick={finish}>
        {purchased ? i18n.message("merchant.continue", "Continue") : i18n.message("merchant.leave", "Leave")}
      </Button>
    </Screen>
  );
}
