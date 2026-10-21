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

it("pages through the full collection, resets filters and preserves focus across supported heights", async () => {
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
    draft.discovery.recruited.mossguard = 3;
  });
  const before = structuredClone(game);
  render(
    <TooltipProvider>
      <Collection game={game} controls={{ current: null }} openMenu={vi.fn()} />
    </TooltipProvider>,
  );
  const user = userEvent.setup();
  expect(screen.getByRole("img", { name: "Mossguard: 2 of 5 stars" })).toBeTruthy();
  const firstPage = screen
    .getAllByRole("button", { name: /^Inspect / })
    .map((card) => card.getAttribute("aria-label"));
  expect(firstPage).toHaveLength(8);
  await user.click(screen.getByRole("button", { name: "Next page" }));
  const lastPage = screen
    .getAllByRole("button", { name: /^Inspect / })
    .map((card) => card.getAttribute("aria-label"));
  expect([...firstPage, ...lastPage]).toEqual(SPECIES.map((creature) => `Inspect ${creature.name}`));
  const lastCard = screen.getAllByRole("button", { name: /^Inspect / }).at(-1)!;
  lastCard.focus();
  vi.stubGlobal("innerHeight", 720);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(document.activeElement).toBe(lastCard);
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(lastPage.length);
  expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
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
  expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getAllByRole("button", { name: /^Inspect / })[0]!);
  expect(screen.getByRole("heading", { name: SPECIES[0]!.name })).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(document.activeElement).toBe(screen.getAllByRole("button", { name: /^Inspect / })[0]);
  expect(game).toEqual(before);
});

it("keeps encountered and eligible creatures out of the collected filter until recruited", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const game = produce(createGame(), (draft) => {
    draft.discovery.encountered = ["mossguard", "prismram"];
    draft.discovery.recruited = { mossguard: 1 };
    draft.wins = 1;
  });
  render(
    <TooltipProvider>
      <Collection game={game} controls={{ current: null }} openMenu={vi.fn()} />
    </TooltipProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Collected" }));
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Inspect Mossguard" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Inspect Prismram" })).toBeNull();
});

it("remembers each filter's page and retains its first visible creature when capacity changes", async () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  let width = 120;
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
      height: 300,
    } as DOMRect;
  });
  const game = produce(createGame(), (draft) => {
    draft.discovery.recruited = Object.fromEntries(SPECIES.map((entry) => [entry.id, 1]));
  });
  render(
    <TooltipProvider>
      <Collection game={game} controls={{ current: null }} openMenu={vi.fn()} />
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
  await user.click(screen.getByRole("button", { name: anchor }));
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("tab", { name: "All" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getAllByRole("button", { name: /^Inspect / })[0]!.getAttribute("aria-label")).toBe(anchor);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: anchor }));
});
