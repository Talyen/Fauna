// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { produce } from "immer";
import { createGame } from "../../src/game/engine";
import { accept, winBattle } from "./helpers";
import { SupportOffer, SupportInspector, SupportScreen } from "../../src/ui/support-screen";
afterEach(cleanup);
function merchant() {
  let s = accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" });
  s = winBattle(accept(s, { type: "beginBattle" }));
  return accept(s, { type: "skipRecruit" });
}
it("inspection can be dismissed without a command; Enter commits the saved visit identity", () => {
  const game = merchant(),
    send = vi.fn(() => true);
  const inspect = vi.fn();
  render(<SupportOffer game={game} inspect={inspect} />);
  fireEvent.click(screen.getByRole("button", { name: "Inspect Merchant" }));
  expect(send).not.toHaveBeenCalled();
  expect(inspect).toHaveBeenCalledWith({ support: game.support!.id });
  cleanup();
  render(<SupportInspector game={game} send={send} close={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Enter" }));
  expect(send).toHaveBeenCalledWith({ type: "enterSupport", visit: game.support!.id });
});
it("resolved purchase leaves its own slot visibly owned and all further purchases disabled", () => {
  let game = merchant();
  game = accept(game, { type: "enterSupport", visit: game.support!.id });
  game = accept(game, { type: "buyBoon", visit: game.support!.id, slot: game.support!.stock[0]!.slot });
  render(<SupportScreen game={game} send={() => true} />);
  expect((screen.getByRole("button", { name: "Owned" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Leave" }) as HTMLButtonElement).disabled).toBe(false);
});

it.each([19, 20])("shows Merchant only when an item is affordable with %s Gold", (gold) => {
  const game = produce(merchant(), (d) => {
    d.currency = gold;
  });
  render(<SupportOffer game={game} inspect={() => {}} />);
  expect(!!screen.queryByRole("button", { name: "Inspect Merchant" })).toBe(gold >= 20);
});
it("labels the wallet and prices as Gold", () => {
  const s = merchant();
  const game = accept(s, { type: "enterSupport", visit: s.support!.id });
  render(<SupportScreen game={game} send={() => true} />);
  expect(screen.getByText(/Gold: 20/)).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Buy · 20 Gold" })).toHaveLength(2);
});
