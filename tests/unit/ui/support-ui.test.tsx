// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import type { GameState, StateAt } from "../../../src/game/types";
import type { ReactElement } from "react";
import { render as renderUI, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { produce } from "immer";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { accept, merchantDestination as merchant } from "../../support/game";
import { TeamSelection } from "../../../src/ui/expedition/team-selection";
import { SupportOffer, SupportScreen } from "../../../src/ui/expedition/support-screen";
import { Rewards } from "../../../src/ui/expedition/rewards";
import { OwnedBoons } from "../../../src/ui/expedition/owned-boons";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { BOONS } from "../../../src/game/content";
const render = (ui: ReactElement) => renderUI(ui, { wrapper: TooltipProvider });
afterEach(cleanup);
function requireMerchant(game: GameState) {
  if (game.phase !== "support") throw new Error("Expected an active Merchant visit.");
  return game;
}
it("opens Merchant directly with the saved visit identity", () => {
  const game = merchant(),
    send = vi.fn(() => true);
  render(<SupportOffer game={game} send={send} />);
  fireEvent.click(screen.getByRole("button", { name: "Visit Boon Merchant" }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "enterSupport", visit: game.support!.id });
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("replaces the shelf with the purchased Boon reward, restores it on reload and focuses Continue", () => {
  let game: GameState = merchant();
  game = accept(game, { type: "enterSupport", visit: game.support!.id });
  const send = vi.fn(() => true);
  const { rerender } = render(<SupportScreen game={requireMerchant(game)} send={send} />);
  expect(
    within(screen.getByRole("heading", { name: "Boon Merchant" }).closest("header")!).getByText(
      `${game.currency} Gold`,
    ),
  ).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /^Buy .+ for \d+ Gold$/ })).toHaveLength(3);
  expect(screen.queryByText("Limit 1 per customer - No Refunds!")).toBeNull();
  expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(3);
  fireEvent.click(screen.getAllByRole("button", { name: /^Buy .+ for \d+ Gold$/ })[0]!);
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: "buyBoon",
    visit: game.support!.id,
    slot: game.support!.stock[0]!.slot,
  });
  game = accept(game, { type: "buyBoon", visit: game.support!.id, slot: game.support!.stock[0]!.slot });
  rerender(<SupportScreen game={requireMerchant(game)} send={send} />);
  expect(screen.getByRole("heading", { name: "Boon received" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Purchased Boon" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Buy / })).toBeNull();
  expect(screen.getByText("For this journey")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
  cleanup();
  render(<SupportScreen game={requireMerchant(decodeSave(encodeSave(game)))} send={send} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(send).toHaveBeenLastCalledWith({ type: "leaveSupport", visit: game.support!.id });
});

it.each([-1, 0])("shows Merchant at the lowest committed price plus %s Gold", (offset) => {
  const ready = merchant();
  const gold = Math.min(...ready.support!.stock.map((slot) => slot.price)) + offset;
  const game = produce(ready, (d) => {
    d.currency = gold;
  });
  render(<SupportOffer game={game} send={() => true} />);
  expect(!!screen.queryByRole("button", { name: "Visit Boon Merchant" })).toBe(offset >= 0);
});

it("shows the stocked Boon rules when its artwork receives keyboard focus", async () => {
  const state = merchant();
  const game = requireMerchant(accept(state, { type: "enterSupport", visit: state.support!.id }));
  const boon = BOONS.find((entry) => entry.id === game.support.stock[0]!.boon)!;
  render(<SupportScreen game={game} send={() => true} />);
  document.documentElement.dataset.focus = "visible";
  try {
    fireEvent.focus(screen.getByRole("button", { name: `Inspect ${boon.name}` }));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain(boon.text);
    expect(tooltip.textContent).toContain("One per visit");
  } finally {
    delete document.documentElement.dataset.focus;
  }
});

it("keeps Boon reward choices actionable and owned Boon rules readable", async () => {
  const base = merchant();
  const boon = BOONS[0];
  const game = {
    ...base,
    phase: "boon",
    support: null,
    reward: { outcome: "next", recruits: [], boons: [boon.id], currency: 0, xp: {} },
  } as StateAt<"boon">;
  const send = vi.fn(() => true);
  render(<Rewards game={game} send={send} inspect={() => {}} />);
  document.documentElement.dataset.focus = "visible";
  try {
    const choice = screen.getByRole("button", { name: `Choose ${boon.name}` });
    fireEvent.focus(choice);
    expect((await screen.findByRole("tooltip")).textContent).toContain(boon.text);
    fireEvent.click(choice);
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: "chooseBoon", boon: boon.id });
  } finally {
    delete document.documentElement.dataset.focus;
  }
  cleanup();
  render(<OwnedBoons boons={[boon.id]} />);
  expect(screen.getByRole("img", { name: boon.name })).toBeTruthy();
  expect(screen.getByRole("heading", { name: boon.name })).toBeTruthy();
  expect(
    screen.getByText((_, element) => element?.tagName === "P" && element.textContent === boon.text),
  ).toBeTruthy();
});

it("clears the reward acknowledgment when the choice is rejected", () => {
  const base = merchant();
  const boon = BOONS[0];
  const game = {
    ...base,
    phase: "boon",
    support: null,
    reward: { outcome: "next", recruits: [], boons: [boon.id], currency: 0, xp: {} },
  } as StateAt<"boon">;
  const send = vi.fn(() => false);
  render(<Rewards game={game} send={send} inspect={() => {}} />);
  const choice = screen.getByRole("button", { name: `Choose ${boon.name}` });
  fireEvent.click(choice);
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "chooseBoon", boon: boon.id });
  expect(choice.closest(".reward-option")?.hasAttribute("data-committed")).toBe(false);
});

it("keeps unavailable offers inspectable and rejects purchases with their specific reason", () => {
  const state = merchant();
  const game = produce(accept(state, { type: "enterSupport", visit: state.support!.id }), (d) => {
    d.currency = 0;
  });
  const send = vi.fn(() => true);
  const { rerender } = render(<SupportScreen game={requireMerchant(game)} send={send} />);
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(3);
  expect(screen.getAllByText("Not enough Gold")).toHaveLength(3);
  fireEvent.click(screen.getAllByRole("button", { name: /^Buy .+ for \d+ Gold$/ })[0]!);
  expect(send).not.toHaveBeenCalled();
  rerender(
    <SupportScreen
      game={requireMerchant(
        produce(game, (d) => {
          d.support!.resolved = true;
        }),
      )}
      send={send}
    />,
  );
  expect(screen.getAllByText("Purchase used")).toHaveLength(3);
  fireEvent.click(screen.getAllByRole("button", { name: /^Buy .+ for \d+ Gold$/ })[0]!);
  expect(send).not.toHaveBeenCalled();
});

it("shows the offered Recruit directly and commits only that creature without opening a dialog", () => {
  const game = produce(merchant(), (draft) => {
    draft.expedition!.recruit = "cadenza";
  });
  const send = vi.fn(() => true);
  render(<TeamSelection game={game} send={send} inspect={() => {}} />);
  document.documentElement.dataset.focus = "visible";
  fireEvent.click(screen.getByRole("button", { name: "Recruit Cadenza" }));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Combat$/ }));
  delete document.documentElement.dataset.focus;
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "recruitDestination", species: "cadenza" });
  expect(screen.queryByRole("dialog")).toBeNull();
});
