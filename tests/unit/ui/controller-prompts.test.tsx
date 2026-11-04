// @vitest-environment jsdom
import { expect, it } from "vitest";
import {
  controllerFamily,
  CONTROLLER_PROMPTS,
  localizedControllerPrompts,
} from "../../../src/ui/shared/navigation/controller-prompts";
import { createMessageReader } from "../../../src/ui/shared/localization/messages";
import french from "../../../src/ui/shared/localization/locales/fr.json";

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

it("localizes PlayStation symbol names while retaining the same button positions", () => {
  const reader = createMessageReader("fr", french);
  const prompts = localizedControllerPrompts("playstation", reader);
  expect(prompts).toEqual({ confirm: "Croix", back: "Rond", inspect: "Carré", endTurn: "Triangle" });
  expect(localizedControllerPrompts("xbox", reader)).toEqual(CONTROLLER_PROMPTS.xbox);
});
