import { ActionCard } from "../../src/ui/cards";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { produce } from "immer";
import { dispatch } from "../../src/game/engine";
import { run } from "./helpers";
import { TargetPreview } from "../../src/ui/target-preview";
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/ui/App";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
import { gamepadActions } from "../../src/ui/input";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe("player interface", () => {
  it("drafts through accessible buttons and commits the battle before feedback", async () => {
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "New expedition" }));
    const enter = screen.getByRole("button", { name: "Start expedition" });
    expect((enter as HTMLButtonElement).disabled).toBe(true);
    for (const name of ["Mossback", "Emberfox", "Stormfin"])
      await user.click(screen.getByRole("button", { name: `Choose ${name}` }));
    await user.click(enter);
    expect(session.store.getState().game.phase).toBe("teamSelection");
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    await user.click(screen.getByRole("button", { name: "Begin battle" }));
    expect(session.store.getState().game.phase).toBe("battle");
    expect(screen.getByRole("region", { name: "Enemy row" })).toBeTruthy();
    await act(async () => {
      await session.flush();
    });
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!).phase).toBe("battle");
    await session.dispose();
  });
  it("maps standard controller buttons and sticks to semantic actions", () => {
    const buttons = Array.from({ length: 16 }, (_, i) => ({
      pressed: [0, 2, 3, 12].includes(i),
      touched: false,
      value: 0,
    }));
    expect(gamepadActions({ buttons, axes: [0.8, 0] })).toEqual([
      "confirm",
      "inspect",
      "endTurn",
      "right",
      "up",
    ]);
    expect(gamepadActions({ buttons: [], axes: [0.1, -0.1] })).toEqual([]);
  });
});
it("opens a recoverable error screen when browser storage access itself is denied", async () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Blocked", "SecurityError");
    },
  });
  try {
    const session = createSession(createBrowserPlatform());
    await session.load();
    render(<App session={session} />);
    expect(screen.getByRole("button", { name: "Retry loading" })).toBeTruthy();
    expect(session.store.getState().loadFailed).toBe(true);
    await session.dispose();
  } finally {
    Object.defineProperty(window, "localStorage", original);
  }
});

it("previews Block depletion, exact health loss and knockout without visible HP totals", () => {
  const before = produce(run(), (d) => {
    d.team[0]!.health = 3;
    d.team[0]!.block = 5;
    d.battle!.enemies.forEach((enemy, i) => {
      enemy.targetId = "ally-0";
      enemy.damage = 8;
      if (i > 0) enemy.health = 0;
    });
  });
  const result = dispatch(before, { type: "endTurn" });
  render(<TargetPreview before={before} result={result} targetId="ally-0" />);
  expect(screen.getByLabelText("Block 5 to 0")).toBeTruthy();
  expect(screen.getByLabelText("Knockout")).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "Health" }).getAttribute("aria-valuenow")).toBe("0");
  expect(document.querySelector(".health-number")).toBeNull();
});

it("keeps unavailable cards inspectable and denies activation without explanatory text", async () => {
  const game = run(),
    click = vi.fn(),
    deny = vi.fn(),
    inspect = vi.fn();
  render(
    <TooltipProvider>
      <ActionCard
        card={game.cards[0]!}
        ownerName="Mossback"
        disabled
        onClick={click}
        onDenied={deny}
        onInspect={inspect}
      />
    </TooltipProvider>,
  );
  const button = screen.getByRole("button");
  await userEvent.click(button);
  expect(deny).toHaveBeenCalledWith(button);
  expect(click).not.toHaveBeenCalled();
  expect(button.getAttribute("aria-disabled")).toBe("true");
  expect(screen.queryByText("Not enough mana.")).toBeNull();
  await userEvent.pointer({ target: button, keys: "[MouseRight]" });
  expect(inspect).toHaveBeenCalledOnce();
});

it("keeps creature hover details compact while retaining health, effects and the passive", async () => {
  const { CreatureDetails } = await import("../../src/ui/card-details");
  render(<CreatureDetails kind="mossback" health={17} block={4} marks={2} />);
  expect(screen.getByText("17/32 health · 4 block · 2 marks")).toBeTruthy();
  expect(screen.getByText("Guard cards grant 2 extra block.")).toBeTruthy();
  expect(screen.queryByText(/Bramble Bash/)).toBeNull();
  expect(screen.queryByText(/Shelter/)).toBeNull();
  expect(screen.queryByText(/Forest Mantle/)).toBeNull();
});
