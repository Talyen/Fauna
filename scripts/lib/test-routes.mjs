export const routes = {
  battle: {
    files: ["tests/e2e/expedition.spec.ts", "tests/e2e/combat-controls.spec.ts", "tests/e2e/combat.spec.ts"],
    grep: "battle|combat|turn|Mana|target|swap|Auto-play",
  },
  settings: {
    files: ["tests/e2e/expedition.spec.ts", "tests/e2e/menu-input.spec.ts", "tests/e2e/adoption.spec.ts"],
    grep: "settings|shadcn|text|motion",
  },
  collection: {
    files: ["tests/e2e/expedition.spec.ts", "tests/e2e/adoption.spec.ts"],
    grep: "Collection|inspection|discovery",
  },
  progression: {
    files: ["tests/e2e/expedition.spec.ts", "tests/e2e/adoption.spec.ts"],
    grep: "talent|boon|recruit|victory|journey|unlock|Merchant|Campfire",
  },
  persistence: {
    files: ["tests/e2e/expedition.spec.ts", "tests/e2e/combat-controls.spec.ts"],
    grep: "save|reload|resume|storage|failure",
  },
};
export function routeArguments(name, extras = []) {
  if (!Object.hasOwn(routes, name)) throw new Error(`Choose a route: ${Object.keys(routes).join(", ")}.`);
  if (extras.some((arg) => !["--list", "--headed", "--debug"].includes(arg)))
    throw new Error("Routes accept only --list, --headed, or --debug.");
  const route = routes[name];
  return ["playwright", "test", ...route.files, "--grep", route.grep, "--forbid-only", ...extras];
}
