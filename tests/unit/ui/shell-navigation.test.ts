import { expect, it } from "vitest";
import { activeSurface, initialNavigation, shellNavigation } from "../../../src/ui/shell/navigation";

it("returns through inspection, the pile and its originating pause menu in order", () => {
  let navigation = shellNavigation(initialNavigation, { type: "play" });
  navigation = shellNavigation(navigation, { type: "openPause", instance: 1 });
  navigation = shellNavigation(navigation, { type: "openDialog", modal: "deck" });
  navigation = shellNavigation(navigation, { type: "inspect", item: { species: "mossguard" } });
  expect(activeSurface(navigation, false).top).toBe("inspection");
  navigation = shellNavigation(navigation, { type: "closeInspection" });
  expect(activeSurface(navigation, false)).toMatchObject({ top: "dialog", modal: "deck", paused: true });
  navigation = shellNavigation(navigation, { type: "closeDialog" });
  expect(activeSurface(navigation, false).top).toBe("pause");
  navigation = shellNavigation(navigation, { type: "closePause" });
  expect(activeSurface(navigation, false)).toMatchObject({ top: "page", paused: false });
});

it.each(["home", "pause"] as const)("returns a menu page to its %s origin", (origin) => {
  let navigation =
    origin === "home" ? initialNavigation : shellNavigation(initialNavigation, { type: "play" });
  if (origin === "pause") navigation = shellNavigation(navigation, { type: "openPause", instance: 1 });
  navigation = shellNavigation(navigation, { type: "openMenuPage", page: "settings" });
  expect(activeSurface(navigation, false).paused).toBe(true);
  navigation = shellNavigation(navigation, { type: "backFromPage", instance: 2 });
  expect(navigation.page.route).toBe(origin === "home" ? "home" : "play");
  expect(activeSurface(navigation, false).top).toBe(origin === "home" ? "page" : "pause");
});

it("keeps an inspected pile above the pause menu opened by a Steam overlay", () => {
  let navigation = shellNavigation(initialNavigation, { type: "play" });
  navigation = shellNavigation(navigation, { type: "openDialog", modal: "draw" });
  navigation = shellNavigation(navigation, { type: "inspect", item: { species: "mossguard" } });
  navigation = shellNavigation(navigation, { type: "openPause", instance: 1 });
  expect(activeSurface(navigation, false)).toMatchObject({ top: "inspection", modal: "draw", menu: true });
  navigation = shellNavigation(navigation, { type: "externalBlock" });
  expect(activeSurface(navigation, true)).toMatchObject({
    top: "replacement",
    scope: "replacement",
    paused: true,
  });
});
