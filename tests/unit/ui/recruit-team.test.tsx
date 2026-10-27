import userEvent from "@testing-library/user-event";
import { screenTestEnvironment } from "../../support/ui";
// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecruitTeam } from "../../../src/ui/expedition/recruit-team";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { MessageProvider } from "../../../src/ui/shared/localization/message-context";
import japanese from "../../../src/ui/shared/localization/locales/ja.json";
import { App } from "../../../src/ui/App";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { accept, fullRosterReward } from "../../support/game";

screenTestEnvironment({ visible: true });
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

it("inspects on hover and replaces the chosen creature immediately", async () => {
  const { game, send } = show();
  const user = userEvent.setup();
  const choice = screen.getByRole("button", { name: "Replace Mossguard with Emberback" });
  expect(choice.hasAttribute("aria-pressed")).toBe(false);
  await user.hover(choice);
  expect(send).not.toHaveBeenCalled();
  expect((await screen.findByRole("tooltip")).textContent).toContain("Mossguard");
  expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  await user.click(choice);
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "confirmRecruit", replace: game.team[0]!.id });
});

it("keeps the current team immediately when requested", async () => {
  const { send } = show();
  await userEvent.click(screen.getByRole("button", { name: "Keep team" }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "confirmRecruit" });
});

it("uses localized action names for a direct replacement", async () => {
  const game = selected();
  const send = vi.fn(() => true);
  render(
    <MessageProvider locale="ja" catalog={japanese}>
      <TooltipProvider>
        <RecruitTeam game={game} incoming="emberback" send={send} inspect={() => {}} />
      </TooltipProvider>
    </MessageProvider>,
  );
  expect(screen.getByRole("heading", { name: "生き物を入れ替える" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "チームを維持" })).toBeTruthy();
  const outgoing = japanese["content.species.mossguard.name"].text;
  const incoming = japanese["content.species.emberback.name"].text;
  await userEvent.click(screen.getByRole("button", { name: `${outgoing}を${incoming}に入れ替える` }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "confirmRecruit", replace: game.team[0]!.id });
});

it("resumes the banked recruit and saves the directly chosen replacement", async () => {
  const game = selected();
  localStorage.setItem("fauna.save.v1", JSON.stringify(game));
  let session = createSession(createBrowserPlatform(localStorage));
  await session.load();
  let view = render(<App session={session} />);
  const user = userEvent.setup();
  try {
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Replace a creature" })).toBeTruthy();
    const committed = session.store.getState().game;
    await user.hover(screen.getByRole("button", { name: "Replace Mossguard with Emberback" }));
    expect(session.store.getState().game).toBe(committed);
    await session.flush();
    expect(JSON.parse(localStorage.getItem("fauna.save.v1")!)).toEqual(committed);
    view.unmount();
    await session.dispose();
    session = createSession(createBrowserPlatform(localStorage));
    await session.load();
    view = render(<App session={session} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(session.store.getState().game).toEqual(committed);
    await user.click(screen.getByRole("button", { name: "Replace Mossguard with Emberback" }));
    const confirmed = session.store.getState().game;
    expect(confirmed.team[0]!.species).toBe("emberback");
    expect(confirmed.discovery).toEqual(game.discovery);
    expect(confirmed.phase).toBe("teamSelection");
    await session.flush();
    view.unmount();
    await session.dispose();
    session = createSession(createBrowserPlatform(localStorage));
    await session.load();
    expect(session.store.getState().game).toEqual(confirmed);
  } finally {
    view.unmount();
    await session.dispose();
  }
});
