import { screenTestEnvironment } from "../../support/ui";
// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { produce } from "immer";
import { MessageProvider } from "../../../src/ui/shared/localization/message-context";
import french from "../../../src/ui/shared/localization/locales/fr.json";
import { Collection } from "../../../src/ui/collection/collection";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { createGame } from "../../../src/game/engine";
import { BOONS, SPECIES } from "../../../src/game/content";

screenTestEnvironment();

it("browses Fauna and Boons without changing progression and remembers each tab's page", async () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const game = produce(createGame(), (draft) => {
    draft.discovery.recruited = Object.fromEntries(SPECIES.map((entry) => [entry.id, 1]));
    draft.discovery.recruited.mossguard = 3;
  });
  const before = structuredClone(game);
  const inspect = vi.fn();
  render(
    <TooltipProvider>
      <Collection game={game} controls={{ current: null }} openMenu={vi.fn()} inspect={inspect} />
    </TooltipProvider>,
  );
  const user = userEvent.setup();
  expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(6);
  await user.click(screen.getByRole("button", { name: "Next page" }));
  const faunaAnchor = screen.getAllByRole("button", { name: /^Inspect / })[0]!.getAttribute("aria-label")!;
  await user.click(screen.getByRole("tab", { name: "Boons" }));
  expect(screen.getByRole("img", { name: BOONS[0]!.name })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  const boonAnchor = screen.getByRole("img", { name: BOONS[8]!.name });
  expect(boonAnchor).toBeTruthy();
  await user.click(screen.getByRole("tab", { name: "Fauna" }));
  expect(screen.getByRole("button", { name: faunaAnchor })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: faunaAnchor }));
  expect(inspect).toHaveBeenCalledWith({ species: SPECIES[6]!.id, speciesKit: true });
  await user.click(screen.getByRole("tab", { name: "Boons" }));
  expect(screen.getByRole("img", { name: BOONS[8]!.name })).toBeTruthy();
  expect(game).toEqual(before);
});

it("shows uncollected creature and Boon details on hover without activating either", async () => {
  const game = produce(createGame(), (draft) => {
    draft.discovery.recruited = { mossguard: 1 };
  });
  const inspect = vi.fn();
  render(
    <TooltipProvider delayDuration={0}>
      <Collection game={game} controls={{ current: null }} openMenu={vi.fn()} inspect={inspect} />
    </TooltipProvider>,
  );
  const user = userEvent.setup();
  const collected = screen.getByRole("button", { name: "Inspect Mossguard" });
  expect(screen.queryByRole("img", { name: /Mossguard: .* stars/ })).toBeNull();
  await user.hover(collected);
  expect(await screen.findByRole("img", { name: "Mossguard: 0 of 5 stars" })).toBeTruthy();
  const locked = screen.getAllByRole("img", { name: "Locked species" })[0]!;
  await user.hover(locked);
  expect((await screen.findByRole("tooltip")).textContent).toContain(
    SPECIES.find((entry) => entry.id !== "mossguard")!.name,
  );
  expect(screen.queryByRole("img", { name: /stars/ })).toBeNull();
  await user.click(locked);
  expect(inspect).not.toHaveBeenCalled();
  await user.click(screen.getByRole("tab", { name: "Boons" }));
  await user.hover(screen.getByRole("img", { name: BOONS[0]!.name }));
  expect((await screen.findByRole("tooltip")).textContent).toContain(BOONS[0]!.name);
  expect(inspect).not.toHaveBeenCalled();
});

it("retains the first visible creature when the grid capacity changes", async () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  let width = 120;
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
      <Collection game={game} controls={{ current: null }} openMenu={vi.fn()} inspect={vi.fn()} />
    </TooltipProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  const anchor = screen.getAllByRole("button", { name: /^Inspect / })[0]!.getAttribute("aria-label")!;
  width = 250;
  act(() => window.dispatchEvent(new Event("resize")));
  expect(screen.getAllByRole("button", { name: /^Inspect / })[0]!.getAttribute("aria-label")).toBe(anchor);
});

it("keeps localized creature details and inspection identity", async () => {
  const game = produce(createGame(), (draft) => {
    draft.discovery.recruited = { mossguard: 3 };
  });
  const inspect = vi.fn();
  render(
    <MessageProvider locale="fr" catalog={french}>
      <TooltipProvider>
        <Collection game={game} controls={{ current: null }} openMenu={vi.fn()} inspect={inspect} />
      </TooltipProvider>
    </MessageProvider>,
  );
  const creature = screen.getByRole("button", { name: "Examiner Mossguard" });
  await userEvent.hover(creature);
  expect(await screen.findByRole("img", { name: "Mossguard : 2 étoiles sur 5" })).toBeTruthy();
  await userEvent.click(creature);
  expect(inspect).toHaveBeenCalledWith({ species: "mossguard", speciesKit: true });
});
