import userEvent from "@testing-library/user-event";
import { screenTestEnvironment } from "../../support/ui";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { produce } from "immer";
import { App } from "../../../src/ui/App";
import { createGame } from "../../../src/game/engine";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";

screenTestEnvironment({ visible: true });

describe("menu browsing", () => {
  it("explains talents before hover and updates requirements after purchases and category reset", async () => {
    const game = produce(createGame(7), (draft) => {
      draft.keywordXP.physical = 10;
      draft.keywordXP.block = 10;
      draft.talents = ["block.second-wind"];
    });
    localStorage.setItem("fauna.save.v1", JSON.stringify(game));
    const session = createSession(createBrowserPlatform(localStorage), 7);
    await session.load();
    const user = userEvent.setup();
    render(<App session={session} />);
    try {
      await user.click(screen.getByRole("button", { name: "Talents" }));
      const physical = screen.getByRole("button", { name: "Physical talents" });
      expect(document.getElementById(physical.getAttribute("aria-describedby")!)?.textContent).toBe(
        "1 point available",
      );
      expect(screen.getByRole("button", { name: "Block talents" }).hasAttribute("aria-describedby")).toBe(
        false,
      );
      await user.click(physical);
      expect(screen.getByRole("button", { name: "Reset Physical talents" }).hasAttribute("disabled")).toBe(
        true,
      );
      const slam = screen.getByRole("button", { name: "Shield Slam" });
      expect(slam.textContent).toContain("Add half your Block to Physical damage");
      expect(within(slam).getByText("Unlock · 1 point")).toBeTruthy();
      await user.click(slam);
      expect(screen.getByRole("button", { name: "Shield Slam, unlocked" })).toBeTruthy();
      const fists = screen.getByRole("button", { name: "Armored Fists" });
      expect(within(fists).getByText("Requires 1 point")).toBeTruthy();
      const revision = session.store.getState().game.revision;
      await user.click(fists);
      expect(session.store.getState().game.revision).toBe(revision);
      await user.click(screen.getByRole("button", { name: "Reset Physical talents" }));
      expect(session.store.getState().game.talents).toEqual(["block.second-wind"]);
      expect(session.store.getState().game.keywordXP).toEqual(game.keywordXP);
      expect(screen.getByRole("button", { name: "Reset Physical talents" }).hasAttribute("disabled")).toBe(
        true,
      );
      expect(
        within(screen.getByRole("button", { name: "Armored Fists" })).getByText("Unlock · 1 point"),
      ).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Shield Slam" }));
      await user.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "Physical talents" })).toBeTruthy();
      await user.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "Talents" })).toBeTruthy();
    } finally {
      cleanup();
      await session.dispose();
    }
  });
});
