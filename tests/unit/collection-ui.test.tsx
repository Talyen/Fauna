// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { produce } from "immer";
import { Collection } from "../../src/ui/expedition-screens";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { createGame } from "../../src/game/engine";
import { SPECIES } from "../../src/game/content";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("shows the current collection on one page, resets filters and preserves focus across supported heights", async () => {
  vi.stubGlobal("innerHeight", 1080);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const game = produce(createGame(), (draft) => {
    draft.discovery.encountered = SPECIES.map((entry) => entry.id);
    draft.discovery.recruited = Object.fromEntries(SPECIES.map((entry) => [entry.id, 1]));
    draft.discovery.recruited.mossback = 3;
  });
  const before = structuredClone(game);
  const inspect = vi.fn();
  render(
    <TooltipProvider>
      <Collection game={game} inspect={inspect} openMenu={vi.fn()} />
    </TooltipProvider>,
  );
  const user = userEvent.setup();
  expect(screen.getByRole("img", { name: "Mossback: 2 of 5 stars" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(SPECIES.length);
  const lastCard = screen.getAllByRole("button", { name: /^Inspect / }).at(-1)!;
  lastCard.focus();
  vi.stubGlobal("innerHeight", 720);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(document.activeElement).toBe(lastCard);
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(SPECIES.length);
  expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  const current = screen.getAllByRole("button", { name: /^Inspect / })[0]!.getAttribute("aria-label");
  vi.stubGlobal("innerHeight", 1080);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(
    screen.getAllByRole("button", { name: /^Inspect / }).map((el) => el.getAttribute("aria-label")),
  ).toContain(current);
  vi.stubGlobal("innerHeight", 720);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(screen.getAllByRole("button", { name: /^Inspect / })[0]!.getAttribute("aria-label")).toBe(current);
  await user.click(screen.getByRole("tab", { name: "Uncollected" }));
  expect(screen.getByRole("img", { name: "No creatures in this view" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  await user.click(screen.getByRole("tab", { name: "Collected" }));
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
  await user.click(screen.getAllByRole("button", { name: /^Inspect / })[0]!);
  expect(inspect).toHaveBeenCalledWith({ species: SPECIES[0]!.id });
  expect(game).toEqual(before);
});

it("keeps encountered and victory-unlocked creatures out of the collected filter until recruited", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const game = produce(createGame(), (draft) => {
    draft.discovery.encountered = ["mossback", "moonhart"];
    draft.discovery.recruited = { mossback: 1 };
    draft.unlocked.push("moonhart");
    draft.wins = 1;
  });
  render(
    <TooltipProvider>
      <Collection game={game} inspect={vi.fn()} openMenu={vi.fn()} />
    </TooltipProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Collected" }));
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Inspect Mossback" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Inspect Moonhart" })).toBeNull();
});

it("remembers each filter's page and retains its first visible creature when capacity changes", async () => {
  let width = 500;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return {
      x: 0,
      y: 0,
      width: this.classList.contains("collection-grid") ? width : 240,
      height: 180,
    } as DOMRect;
  });
  const game = produce(createGame(), (draft) => {
    draft.discovery.recruited = Object.fromEntries(SPECIES.map((entry) => [entry.id, 1]));
  });
  render(
    <TooltipProvider>
      <Collection game={game} inspect={vi.fn()} openMenu={vi.fn()} />
    </TooltipProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  const anchor = screen.getAllByRole("button", { name: /^Inspect / })[0]!.getAttribute("aria-label")!;
  await user.click(screen.getByRole("tab", { name: "Collected" }));
  expect(screen.queryByRole("button", { name: anchor })).toBeNull();
  await user.click(screen.getByRole("tab", { name: "All" }));
  expect(screen.getByRole("button", { name: anchor })).toBeTruthy();
  width = 250;
  act(() => window.dispatchEvent(new Event("resize")));
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: /^Inspect / })[0]!.getAttribute("aria-label")).toBe(anchor);
});
