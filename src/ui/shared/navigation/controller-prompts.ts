import type { createMessageReader } from "../localization/messages";

export type ControllerFamily = "xbox" | "playstation" | "nintendo";
export type ControllerPreference = "auto" | ControllerFamily;
export function controllerFamily(id: string): ControllerFamily {
  if (/playstation|dualsense|dualshock|sony|054c/i.test(id)) return "playstation";
  if (/nintendo|switch|joy-con/i.test(id)) return "nintendo";
  return "xbox";
}
export const CONTROLLER_PROMPTS = {
  xbox: { confirm: "A", back: "B", inspect: "X", endTurn: "Y" },
  playstation: { confirm: "Cross", back: "Circle", inspect: "Square", endTurn: "Triangle" },
  nintendo: { confirm: "B", back: "A", inspect: "Y", endTurn: "X" },
} as const;
/** Button positions remain fixed; only the names of PlayStation symbols are translated. */
export function localizedControllerPrompts(
  family: ControllerFamily,
  i18n: ReturnType<typeof createMessageReader>,
) {
  if (family !== "playstation") return CONTROLLER_PROMPTS[family];
  return {
    confirm: i18n.message("controller.cross", "Cross"),
    back: i18n.message("controller.circle", "Circle"),
    inspect: i18n.message("controller.square", "Square"),
    endTurn: i18n.message("controller.triangle", "Triangle"),
  };
}
