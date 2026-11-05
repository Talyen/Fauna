// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { screenTestEnvironment } from "../../support/ui";
import { createSession } from "../../../src/application/session";
import { Inspector } from "../../../src/ui/inspection/inspection";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import type { Controls } from "../../../src/ui/shared/navigation/input";

screenTestEnvironment();

it("orders Back against pending forward and backward inspection transitions", async () => {
  const session = createSession(
    { desktop: false, saves: { readCandidates: async () => [], write: async () => {} } },
    7,
  );
  await session.load();
  const controls: Controls = { current: null };
  const view = render(
    <TooltipProvider>
      <Inspector
        item={{ species: "emberback", speciesKit: true }}
        session={session}
        controls={controls}
        onClose={vi.fn()}
      />
    </TooltipProvider>,
  );
  try {
    act(() => {
      screen.getByRole("button", { name: /^Ember Charge,/ }).click();
      expect(controls.current?.("back")).toBe(true);
    });
    expect(screen.getByRole("heading", { name: "Emberback" })).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Ember Charge,/ }));
    expect(screen.getByRole("dialog", { name: "Ember Charge details" })).toBeTruthy();
    act(() => {
      expect(controls.current?.("back")).toBe(true);
      expect(controls.current?.("back")).toBe(false);
    });
  } finally {
    view.unmount();
    await session.dispose();
  }
});
