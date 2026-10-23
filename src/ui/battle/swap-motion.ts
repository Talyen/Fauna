import { captureArtworkSwap } from "../shared/cards/swap-motion";

/** Visual copies outlive the closing picker; gameplay and focus transfer immediately. */
export function captureSwapMotion(activeId: string, reserveId: string) {
  const root = document.querySelector(".swap-dialog");
  return captureArtworkSwap(
    [activeId, reserveId].map((id) =>
      root?.querySelector<HTMLElement>(`[data-actor-id="${id}"] .creature-card`),
    ),
  );
}
