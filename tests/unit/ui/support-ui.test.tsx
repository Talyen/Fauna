// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import type { ReactElement } from "react";
import { render as renderUI, screen, fireEvent, cleanup } from "@testing-library/react";
import { produce } from "immer";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { createGame } from "../../../src/game/engine";
import { recruitChoice, accept, winBattle } from "../../support/game";
import { TeamSelection } from "../../../src/ui/expedition/team-selection";
import { SupportOffer, SupportScreen } from "../../../src/ui/expedition/support-screen";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
const render = (ui: ReactElement) => renderUI(ui, { wrapper: TooltipProvider });
afterEach(cleanup);
function merchant() {
  let s = accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }), {
    type: "start",
  });
  s = winBattle(accept(s, { type: "beginBattle" }));
  return accept(s, recruitChoice(s));
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
  let game = merchant();
  game = accept(game, { type: "enterSupport", visit: game.support!.id });
  const send = vi.fn(() => true);
  const { rerender } = render(<SupportScreen game={game} send={send} />);
  fireEvent.click(screen.getAllByRole("button", { name: /^Buy .+ for 20 Gold$/ })[0]!);
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: "buyBoon",
    visit: game.support!.id,
    slot: game.support!.stock[0]!.slot,
  });
  game = accept(game, { type: "buyBoon", visit: game.support!.id, slot: game.support!.stock[0]!.slot });
  rerender(<SupportScreen game={game} send={send} />);
  expect(screen.getByRole("heading", { name: "Boon received" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Purchased Boon" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Buy / })).toBeNull();
  expect(screen.getByText("For this journey")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
  cleanup();
  render(<SupportScreen game={decodeSave(encodeSave(game))} send={send} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(send).toHaveBeenLastCalledWith({ type: "leaveSupport", visit: game.support!.id });
});

it.each([19, 20])("shows Merchant only when an item is affordable with %s Gold", (gold) => {
  const game = produce(merchant(), (d) => {
    d.currency = gold;
  });
  render(<SupportOffer game={game} send={() => true} />);
  expect(!!screen.queryByRole("button", { name: "Visit Boon Merchant" })).toBe(gold >= 20);
});
it("labels the wallet and prices as Gold", () => {
  const s = merchant();
  const game = accept(s, { type: "enterSupport", visit: s.support!.id });
  render(<SupportScreen game={game} send={() => true} />);
  expect(screen.getAllByText("20 Gold")[0]).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /^Buy .+ for 20 Gold$/ })).toHaveLength(3);
  expect(screen.getByText("Limit 1 per customer")).toBeTruthy();
});

it("keeps unavailable offers inspectable and rejects purchases with their specific reason", () => {
  const state = merchant();
  const game = produce(accept(state, { type: "enterSupport", visit: state.support!.id }), (d) => {
    d.currency = 0;
  });
  const send = vi.fn(() => true);
  const { rerender } = render(<SupportScreen game={game} send={send} />);
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(3);
  expect(screen.getAllByText("Not enough Gold")).toHaveLength(3);
  fireEvent.click(screen.getAllByRole("button", { name: /^Buy .+ for 20 Gold$/ })[0]!);
  expect(send).not.toHaveBeenCalled();
  rerender(
    <SupportScreen
      game={produce(game, (d) => {
        d.support!.resolved = true;
      })}
      send={send}
    />,
  );
  expect(screen.getAllByText("Purchase used")).toHaveLength(3);
  fireEvent.click(screen.getAllByRole("button", { name: /^Buy .+ for 20 Gold$/ })[0]!);
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
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Combat", exact: true }));
  delete document.documentElement.dataset.focus;
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "recruitDestination", species: "cadenza" });
  expect(screen.queryByRole("dialog")).toBeNull();
});
