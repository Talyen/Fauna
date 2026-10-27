// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  controllerFamily,
  CONTROLLER_PROMPTS,
  localizedControllerPrompts,
} from "../../../src/ui/shared/navigation/controller-prompts";
import { GlossaryScreen } from "../../../src/ui/menu/glossary-screen";
import { MessageProvider } from "../../../src/ui/shared/localization/message-context";
import { createMessageReader } from "../../../src/ui/shared/localization/messages";
import french from "../../../src/ui/shared/localization/locales/fr.json";
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
  expect(screen.getByText(/Cross activates; Square inspects artwork outside battle/)).toBeTruthy();
  expect(screen.queryByText(/W\/A\/S\/D/)).toBeNull();
});

it("localizes PlayStation symbol names while retaining the same button positions", () => {
  const reader = createMessageReader("fr", french);
  const prompts = localizedControllerPrompts("playstation", reader);
  expect(prompts).toEqual({ confirm: "Croix", back: "Rond", inspect: "Carré", endTurn: "Triangle" });
  expect(localizedControllerPrompts("xbox", reader)).toEqual(CONTROLLER_PROMPTS.xbox);
  render(
    <MessageProvider locale="fr" catalog={french}>
      <GlossaryScreen back={() => {}} controller prompts={prompts} />
    </MessageProvider>,
  );
  const help = screen.getByText(/Croix/).textContent;
  expect(help).toContain("Rond");
  expect(help).toContain("Carré");
  expect(help).toContain("Triangle");
});
