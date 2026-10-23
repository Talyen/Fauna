import userEvent from "@testing-library/user-event";
import { screenTestEnvironment } from "../../support/ui";
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecruitTeam } from "../../../src/ui/expedition/recruit-team";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { App } from "../../../src/ui/App";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { accept, fullRosterReward } from "../../support/game";

screenTestEnvironment({ visible: true });
afterEach(() => document.documentElement.style.removeProperty("--motion-fast"));
function selected() {
  const game = accept(fullRosterReward(), { type: "recruit", species: "emberback" });
  if (game.phase !== "recruit") throw new Error("Expected committed recruitment");
  return game;
}
function show() {
  const game = selected(),
    send = vi.fn(() => true),
    inspect = vi.fn();
  const view = render(
    <TooltipProvider>
      <RecruitTeam game={game} incoming="emberback" send={send} inspect={inspect} />
    </TooltipProvider>,
  );
  return { game, send, inspect, view };
}

it("previews one replacement at a time, keeps artwork reversible, and commits only from Confirm", async () => {
  const { game, send } = show();
  const user = userEvent.setup();
  const before = JSON.stringify(game);
  const cards = () => [
    ...document.querySelectorAll<HTMLButtonElement>(".recruit-team-roster .creature-card"),
  ];
  const kind = (index: number) => cards()[index]!.dataset.species;
  expect(cards()).toHaveLength(5);
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Keep current team" })).toBeNull();
  await user.click(cards()[0]!);
  expect(kind(0)).toBe("emberback");
  expect(document.querySelector(".recruit-team-exchange .creature-card")?.getAttribute("data-species")).toBe(
    game.team[0]!.species,
  );
  expect(send).not.toHaveBeenCalled();
  await user.click(cards()[2]!);
  expect(kind(0)).toBe(game.team[0]!.species);
  expect(kind(2)).toBe("emberback");
  await user.click(cards()[2]!);
  expect(kind(2)).toBe(game.team[2]!.species);
  expect(JSON.stringify(game)).toBe(before);
  await user.click(cards()[4]!);
  expect(send).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirm" }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "confirmRecruit", replace: game.reserves[1]!.id });
});

it("accepts the unchanged team with the single Confirm action", async () => {
  const { send } = show();
  await userEvent.setup().click(screen.getByRole("button", { name: "Confirm" }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "confirmRecruit", replace: undefined });
});

it("keeps confirmation available while battle-style visual copies are in flight", async () => {
  document.documentElement.style.setProperty("--motion-fast", "150ms");
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 213, 160));
  const { send, view } = show();
  const user = userEvent.setup();
  await user.click(document.querySelector<HTMLButtonElement>(".recruit-team-roster .creature-card")!);
  expect(document.querySelectorAll('body > .creature-card[aria-hidden="true"]')).toHaveLength(2);
  const confirm = screen.getByRole("button", { name: "Confirm" });
  expect(confirm.hasAttribute("disabled")).toBe(false);
  await user.click(confirm);
  expect(send).toHaveBeenCalledOnce();
  expect(document.querySelectorAll('body > .creature-card[aria-hidden="true"]')).toHaveLength(0);
  expect(
    [...document.querySelectorAll<HTMLImageElement>(".recruit-team-screen img")].every(
      (img) => img.style.visibility !== "hidden",
    ),
  ).toBe(true);
  view.unmount();
});

it("resumes the banked recruit directly at team selection, without saving previews or repeating Collection progress", async () => {
  const game = selected();
  localStorage.setItem("fauna.save.v1", JSON.stringify(game));
  const session = createSession(createBrowserPlatform(localStorage));
  await session.load();
  const view = render(<App session={session} />);
  const user = userEvent.setup();
  try {
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Choose your team" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Victory" })).toBeNull();
    const committed = session.store.getState().game;
    await user.click(document.querySelector<HTMLButtonElement>(".recruit-team-roster .creature-card")!);
    expect(session.store.getState().game).toBe(committed);
    await session.flush();
    view.unmount();
    render(<App session={session} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(document.querySelector('.recruit-team-roster .creature-card[aria-pressed="true"]')).toBeNull();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(session.store.getState().game.roster).toEqual(game.roster);
    expect(session.store.getState().game.discovery).toEqual(game.discovery);
  } finally {
    await session.dispose();
  }
});
