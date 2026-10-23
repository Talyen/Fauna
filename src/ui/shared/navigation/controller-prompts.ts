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
