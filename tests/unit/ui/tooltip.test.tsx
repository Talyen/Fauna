// @vitest-environment jsdom
import { screenTestEnvironment } from "../../support/ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreatureCard } from "../../../src/ui/shared/cards/cards";
import { Button } from "../../../src/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../src/components/ui/tooltip";

screenTestEnvironment();
afterEach(() => {
  delete document.documentElement.dataset.focus;
  vi.useRealTimers();
});

function Details() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button>Inspect creature</Button>
        </TooltipTrigger>
        <TooltipContent>32/32 health</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe("shared hover details", () => {
  it("retains the native hover delay when immediate pointer restoration is disabled", () => {
    vi.useFakeTimers();
    render(
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild reopenOnPointerMove={false}>
            <Button>Delayed details</Button>
          </TooltipTrigger>
          <TooltipContent>Delayed information</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button");
    const movement = new Event("pointermove", { bubbles: true });
    Object.defineProperties(movement, { pointerType: { value: "mouse" }, buttons: { value: 0 } });
    fireEvent(trigger, movement);
    act(() => vi.advanceTimersByTime(199));
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("dismisses on activation and restores on a fresh mouse move without leaving the card", async () => {
    render(<Details />);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button");
    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    await user.click(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.pointer({ target: trigger, coords: { x: 10, y: 10 } });
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("dismisses on blur or hiding and restores only on fresh input after returning", async () => {
    render(<Details />);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button");
    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    for (const [index, boundary] of (["focus", "visibility"] as const).entries()) {
      if (boundary === "focus") fireEvent(window, new Event("blur"));
      else {
        vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        fireEvent(document, new Event("visibilitychange"));
      }
      expect(screen.queryByRole("tooltip")).toBeNull();
      if (boundary === "focus") fireEvent(window, new Event("focus"));
      else {
        vi.spyOn(document, "hidden", "get").mockReturnValue(false);
        fireEvent(document, new Event("visibilitychange"));
      }
      expect(screen.queryByRole("tooltip")).toBeNull();
      await user.pointer({ target: trigger, coords: { x: 10 + index, y: 10 } });
      expect(await screen.findByRole("tooltip")).toBeTruthy();
    }
  });

  it("shows focus details only during intentional keyboard or controller navigation", async () => {
    render(<Details />);
    const user = userEvent.setup();
    document.documentElement.dataset.focus = "hidden";
    fireEvent.focus(screen.getByRole("button"));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.blur(screen.getByRole("button"));
    document.documentElement.dataset.focus = "visible";
    await user.tab();
    expect(await screen.findByRole("tooltip")).toBeTruthy();
  });
});

it("does not reopen stale creature details when targeting reenables tooltips", async () => {
  const card = (enabled: boolean) => (
    <TooltipProvider delayDuration={0}>
      <CreatureCard kind="mossguard" label="Inspect Mossguard" onClick={() => {}} tooltips={enabled} />
    </TooltipProvider>
  );
  const view = render(card(true));
  const user = userEvent.setup();
  await user.hover(screen.getByRole("button", { name: "Inspect Mossguard" }));
  expect(await screen.findByRole("tooltip")).toBeTruthy();
  view.rerender(card(false));
  expect(screen.queryByRole("tooltip")).toBeNull();
  view.rerender(card(true));
  expect(screen.queryByRole("tooltip")).toBeNull();
  await user.pointer({
    target: screen.getByRole("button", { name: "Inspect Mossguard" }),
    coords: { x: 10, y: 10 },
  });
  expect(await screen.findByRole("tooltip")).toBeTruthy();
});
