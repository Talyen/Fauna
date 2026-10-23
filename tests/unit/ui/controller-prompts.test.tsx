// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { controllerFamily, CONTROLLER_PROMPTS } from "../../../src/ui/shared/navigation/controller-prompts";
import { GlossaryScreen } from "../../../src/ui/menu/glossary-screen";
afterEach(cleanup);

it("uses controller-specific labels for the same standard gamepad positions", () => {
  expect(controllerFamily("Sony Interactive Entertainment Wireless Controller (054c) ")).toBe("playstation");
  expect(controllerFamily("Nintendo Switch Pro Controller")).toBe("nintendo");
  expect(controllerFamily("Xbox 360 Controller (Steam Input)")).toBe("xbox");
  expect(CONTROLLER_PROMPTS.playstation).toMatchObject({
    confirm: "Cross",
    back: "Circle",
    endTurn: "Triangle",
  });
  expect(CONTROLLER_PROMPTS.nintendo).toMatchObject({ confirm: "B", back: "A", endTurn: "X" });
});

it("shows the selected controller instructions without keyboard prompts", () => {
  render(<GlossaryScreen back={() => {}} controller prompts={CONTROLLER_PROMPTS.playstation} />);
  expect(screen.getByText(/Cross selects; Circle goes back; Triangle ends the turn/)).toBeTruthy();
  expect(screen.queryByText(/W\/A\/S\/D/)).toBeNull();
});
