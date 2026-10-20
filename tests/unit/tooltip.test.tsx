// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../../src/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/components/ui/tooltip";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.focus;
  vi.unstubAllGlobals();
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

  it("dismisses when the window loses focus and only restores with fresh input", async () => {
    render(<Details />);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button");
    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    fireEvent(window, new Event("blur"));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent(window, new Event("focus"));
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.pointer({ target: trigger, coords: { x: 10, y: 10 } });
    expect(await screen.findByRole("tooltip")).toBeTruthy();
  });

  it("dismisses details when the document becomes hidden", async () => {
    render(<Details />);
    const user = userEvent.setup();
    await user.hover(screen.getByRole("button"));
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByRole("tooltip")).toBeNull();
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
