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

it("pages the collection, resets filters and keeps every creature reachable after resizing", async () => {
  let resize = () => {};
  let width = 824;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 266.6667 } as DOMRect);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  const game = produce(createGame(), (draft) => {
    draft.discovery.encountered = SPECIES.map((entry) => entry.id);
  });
  const before = structuredClone(game);
  const inspect = vi.fn();
  render(
    <TooltipProvider>
      <Collection game={game} inspect={inspect} back={vi.fn()} />
    </TooltipProvider>,
  );
  const user = userEvent.setup();
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(6);
  expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  width = 560;
  act(() => resize());
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(4);
  expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
  const seen = new Set<string>();
  while (true) {
    screen
      .getAllByRole("button", { name: /^Inspect / })
      .forEach((button) => seen.add(button.getAttribute("aria-label")!));
    const next = screen.queryByRole("button", { name: "Next page" }) as HTMLButtonElement | null;
    if (!next) break;
    await user.click(next);
  }
  expect(seen.size).toBe(SPECIES.length);
  width = 280;
  act(() => resize());
  expect(screen.getAllByRole("button", { name: /^Inspect / }).length).toBeLessThanOrEqual(2);
  await user.click(screen.getByRole("tab", { name: "Unknown" }));
  expect(screen.getByRole("img", { name: "No creatures in this view" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  await user.click(screen.getByRole("tab", { name: "Known" }));
  expect(screen.getByRole("status").textContent).toMatch(/^1 \/ /);
  await user.click(screen.getAllByRole("button", { name: /^Inspect / })[0]!);
  expect(inspect).toHaveBeenCalledWith({ species: SPECIES[0]!.id });
  expect(game).toEqual(before);
});
