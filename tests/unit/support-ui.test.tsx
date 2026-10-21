// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import type { ReactElement } from "react";
import { render as renderUI, screen, fireEvent, cleanup } from "@testing-library/react";
import { produce } from "immer";
import { createGame } from "../../src/game/engine";
import { recruitChoice, accept, winBattle } from "./helpers";
import { SupportOffer, SupportScreen } from "../../src/ui/support-screen";
import { TooltipProvider } from "../../src/components/ui/tooltip";
const render = (ui: ReactElement) => renderUI(ui, { wrapper: TooltipProvider });
afterEach(cleanup);
function merchant() {
  let s = accept(accept(createGame(7), { type: "draft", species: "mossguard" }), { type: "start" });
  s = winBattle(accept(s, { type: "beginBattle" }));
  return accept(s, recruitChoice(s));
}
it("opens Merchant directly with the saved visit identity", () => {
  const game = merchant(),
    send = vi.fn(() => true);
  render(<SupportOffer game={game} send={send} />);
  fireEvent.click(screen.getByRole("button", { name: "Visit Merchant" }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "enterSupport", visit: game.support!.id });
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("resolved purchase leaves its own slot visibly owned and all further purchases disabled", () => {
  let game = merchant();
  game = accept(game, { type: "enterSupport", visit: game.support!.id });
  game = accept(game, { type: "buyBoon", visit: game.support!.id, slot: game.support!.stock[0]!.slot });
  render(<SupportScreen game={game} send={() => true} />);
  expect(screen.getByRole("button", { name: "Owned" }).getAttribute("aria-disabled")).toBe("true");
  expect((screen.getByRole("button", { name: "Leave" }) as HTMLButtonElement).disabled).toBe(false);
});

it.each([19, 20])("shows Merchant only when an item is affordable with %s Gold", (gold) => {
  const game = produce(merchant(), (d) => {
    d.currency = gold;
  });
  render(<SupportOffer game={game} send={() => true} />);
  expect(!!screen.queryByRole("button", { name: "Visit Merchant" })).toBe(gold >= 20);
});
it("labels the wallet and prices as Gold", () => {
  const s = merchant();
  const game = accept(s, { type: "enterSupport", visit: s.support!.id });
  render(<SupportScreen game={game} send={() => true} />);
  expect(screen.getByText(/Gold: 20/)).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Buy · 20 Gold" })).toHaveLength(2);
});

it("keeps unavailable offers inspectable and rejects purchases with their specific reason", () => {
  const state = merchant();
  const game = produce(accept(state, { type: "enterSupport", visit: state.support!.id }), (d) => {
    d.currency = 0;
  });
  const send = vi.fn(() => true);
  const { rerender } = render(<SupportScreen game={game} send={send} />);
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(2);
  expect(screen.getAllByText("Not enough Gold")).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Buy · 20 Gold" })[0]!);
  expect(send).not.toHaveBeenCalled();
  rerender(
    <SupportScreen
      game={produce(game, (d) => {
        d.support!.resolved = true;
      })}
      send={send}
    />,
  );
  expect(screen.getAllByText("Purchase used")).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Buy · 20 Gold" })[0]!);
  expect(send).not.toHaveBeenCalled();
});
