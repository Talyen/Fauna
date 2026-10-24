import { parseSync } from "@swc/core";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { modifierContractViolations, readModifierSources } from "./modifier-contracts.mjs";
const ambient = new Set([
  "window",
  "document",
  "globalThis",
  "global",
  "localStorage",
  "sessionStorage",
  "navigator",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "Date",
  "performance",
  "crypto",
  "process",
  "Buffer",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
  "requestAnimationFrame",
]);
const node = (x) => x && typeof x === "object" && typeof x.type === "string";
function bindings(pattern, names) {
  if (!pattern) return;
  if (pattern.type === "Identifier") names.add(pattern.value);
  else if (pattern.type === "Parameter") bindings(pattern.pat, names);
  else if (pattern.type === "AssignmentPattern") bindings(pattern.left, names);
  else if (pattern.type === "RestElement") bindings(pattern.argument, names);
  else if (pattern.type === "ObjectPattern")
    for (const p of pattern.properties) bindings(p.value ?? p.key ?? p.argument, names);
  else if (pattern.type === "ArrayPattern") for (const p of pattern.elements) bindings(p, names);
}
function collect(n, names, top = true) {
  if (!node(n)) return;
  if (["FunctionDeclaration", "ClassDeclaration"].includes(n.type)) {
    bindings(n.identifier, names);
    if (!top) return;
  }
  if (n.type === "VariableDeclarator") bindings(n.id, names);
  if (n.type === "ImportDeclaration") for (const s of n.specifiers) bindings(s.local, names);
  if (!top && ["FunctionExpression", "ArrowFunctionExpression", "BlockStatement"].includes(n.type)) return;
  for (const [key, value] of Object.entries(n))
    if (key !== "span") {
      if (Array.isArray(value)) for (const child of value) collect(child, names, false);
      else if (node(value)) collect(value, names, false);
    }
}
export function boundaryViolations(file, source) {
  file = file.replaceAll("\\", "/");
  const game = file.startsWith("src/game/");
  const app = file.startsWith("src/application/");
  const platform = file.startsWith("src/platform/");
  const tooling = file.startsWith("src/tooling/");
  const utility = file.startsWith("src/lib/");
  const infrastructure = file.startsWith("src/ui/infrastructure/");
  const primitive = file.startsWith("src/components/ui/");
  const ui = file.startsWith("src/ui/") || file.startsWith("src/components/") || file.startsWith("src/lib/");
  const errors = [];
  const fail = (message) => errors.push(`${file}: ${message}`);
  const ast = parseSync(source, { syntax: "typescript", tsx: file.endsWith(".tsx"), target: "es2022" });
  function imported(specifier, declaration) {
    const target = specifier.startsWith("@/")
      ? `src/${specifier.slice(2)}`
      : specifier.startsWith(".")
        ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
        : specifier;
    const within = (dir) => target.startsWith(`src/${dir}/`);
    if (file === "src/game/modifier-bindings.ts" && !declaration?.typeOnly && target !== "immer")
      fail("Modifier bindings contain pure registration data; import only Immer and types.");
    if (
      target.replace(/\.ts$/, "") === "src/game/modifier-bindings" &&
      file !== "src/game/content-validation.ts" &&
      !declaration?.typeOnly
    )
      fail("Modifier bindings are an authoring boundary; runtime uses named implementation owners.");
    if (
      file.startsWith("src/game/rules/") &&
      !declaration?.typeOnly &&
      target !== "immer" &&
      !within("game/rules")
    )
      fail("Ability rules must remain pure; import only rule modules, Immer or types.");
    if (
      file.startsWith("src/ui/shared/") &&
      within("ui") &&
      !within("ui/shared") &&
      !within("ui/infrastructure")
    )
      fail("Shared presentation cannot import feature owners.");
    if (
      (utility || infrastructure || primitive) &&
      (within("game") ||
        within("application") ||
        within("platform") ||
        (within("ui") && !within("ui/infrastructure")) ||
        ((utility || infrastructure) && within("components")))
    )
      fail("Presentation foundations cannot import gameplay, application, platform or feature owners.");
    if (utility && (/^react(?:-dom)?(?:\/|$)/.test(target) || within("ui/infrastructure")))
      fail("React and DOM lifecycle helpers belong in src/ui/infrastructure.");
    if (file.startsWith("src/") && !tooling && within("tooling"))
      fail(`Runtime imports a development harness: ${specifier}`);
    if (tooling && (within("ui") || within("components") || /^(react(?:-dom)?)(\/|$)/.test(target)))
      fail(`Development harness imports presentation: ${specifier}`);
    const combatTarget = target.replace(/\.ts$/, "").replace(/^src\/game\/combat$/, "src/game/combat/index");
    const combatModule = file.replace(/^src\/game\/combat\//, "").replace(/\.ts$/, "");
    const combatInternal = [
      "state",
      "policy",
      "operations",
      "resolution",
      "damage",
      "damage-reactions",
      "damage-values",
      "healing-values",
      "status-state",
      "protection",
      "statuses",
      "lifecycle",
    ].includes(combatModule);
    if (
      combatInternal &&
      [
        "src/game/combat/index",
        "src/game/combat/abilities",
        "src/game/combat/ability-handlers",
        "src/game/combat/ability-extras",
        "src/game/combat/ability-context",
        "src/game/combat/ability-modifiers",
        "src/game/combat/battle-modifiers",
        "src/game/combat/card-modifiers",
        "src/game/combat/turns",
        "src/game/engine",
        "src/game/journey",
        "src/game/team",
      ].includes(combatTarget)
    )
      fail("Combat internals cannot import their public entry points or command owners.");
    if (
      ["state", "policy", "damage-values", "healing-values", "status-state"].includes(combatModule) &&
      /^src\/game\/combat\/(?:resolution|operations|damage(?:-reactions)?|protection|statuses|lifecycle)$/.test(
        combatTarget,
      )
    )
      fail("Combat foundations cannot schedule reactions.");
    if (
      ["damage", "damage-reactions", "protection", "statuses", "lifecycle"].includes(combatModule) &&
      !declaration?.typeOnly &&
      /^src\/game\/combat\/(?:resolution|damage|protection|statuses|lifecycle)$/.test(combatTarget)
    )
      fail(
        "Combat handlers must yield typed operations instead of entering other handlers or the scheduler.",
      );
    if (game && !within("game") && !["immer", "zod"].includes(target))
      fail(`Gameplay import escapes its owner: ${specifier}`);
    if (
      app &&
      (within("ui") ||
        within("components") ||
        /^(react(?:-dom)?|motion)(\/|$)/.test(target) ||
        target.startsWith("desktop/"))
    )
      fail(`Application imports presentation: ${specifier}`);
    if (platform && (within("ui") || within("components") || (within("game") && !declaration?.typeOnly)))
      fail(`Platform imports presentation or gameplay implementation: ${specifier}`);
    if (
      (game || app || platform || ui || tooling) &&
      (/^(?:node:|electron$|steamworks\.js$|fs(?:\/|$)|path$|child_process$)/.test(target) ||
        target.startsWith("desktop/"))
    )
      fail(`Renderer imports privileged implementation: ${specifier}`);
    if (
      ui &&
      !declaration?.typeOnly &&
      /^src\/game\/(?:(?:journey|team)|combat\/(?:abilit(?:ies|y-(?:handlers|extras|context|modifiers))|(?:battle|card)-modifiers|resolution|operations|damage(?:-reactions)?|status-state|protection|statuses|lifecycle|turns))(?:\.ts)?$/.test(
        target,
      ) &&
      // This selector reads committed state; importing its module's mutators remains forbidden.
      !(
        target.replace(/\.ts$/, "") === "src/game/team" &&
        declaration?.type === "ImportDeclaration" &&
        declaration.specifiers.length > 0 &&
        declaration.specifiers.every(
          (specifier) =>
            specifier.type === "ImportSpecifier" &&
            (specifier.imported?.value ?? specifier.local?.value) === "pendingReplacement",
        )
      )
    )
      fail("UI must use application commands and read-only previews.");
    if (
      ui &&
      within("game") &&
      declaration?.specifiers?.some((s) =>
        ["dispatch", "createGame", "encodeSave", "ensureCombat"].includes(
          s.imported?.value ?? s.local?.value,
        ),
      )
    )
      fail("UI must use application commands and read-only previews.");
  }
  function walk(n, scopes = [], parent, key) {
    if (!node(n)) return;
    const scopeNode = [
      "Module",
      "Script",
      "BlockStatement",
      "FunctionDeclaration",
      "FunctionExpression",
      "ArrowFunctionExpression",
      "CatchClause",
    ].includes(n.type);
    if (scopeNode) {
      const names = new Set();
      collect(n, names);
      for (const p of n.params ?? []) bindings(p, names);
      bindings(n.param, names);
      scopes = [...scopes, names];
    }
    const globalName = (name) => !scopes.some((scope) => scope.has(name));
    if (["ImportDeclaration", "ExportAllDeclaration", "ExportNamedDeclaration"].includes(n.type) && n.source)
      imported(n.source.value, n);
    if (
      n.type === "CallExpression" &&
      (n.callee.type === "Import" ||
        (n.callee.type === "Identifier" && n.callee.value === "require" && globalName("require")))
    ) {
      const argument = n.arguments[0]?.expression;
      if (argument?.type === "StringLiteral") imported(argument.value);
      else if (game) fail("Gameplay module access must be statically resolvable.");
    }
    if (
      game &&
      n.type === "MemberExpression" &&
      n.object.type === "Identifier" &&
      n.object.value === "Math" &&
      globalName("Math") &&
      (n.property.value === "random" ||
        (n.property.type === "Computed" &&
          (n.property.expression?.type !== "StringLiteral" || n.property.expression.value === "random")))
    )
      fail("Gameplay cannot consume ambient randomness.");
    if (
      ui &&
      n.type === "MemberExpression" &&
      ["localStorage", "sessionStorage"].includes(n.property.value ?? n.property.expression?.value)
    )
      fail("UI persistence belongs behind platform capabilities.");
    if (
      game &&
      n.type === "Identifier" &&
      n.value === "Math" &&
      globalName("Math") &&
      !(parent?.type === "MemberExpression" && key === "object") &&
      !["id", "pat", "param", "key"].includes(key)
    )
      fail("Gameplay must not alias ambient Math capabilities.");
    if (n.type === "Identifier") {
      const binding =
        ["id", "pat", "param", "identifier", "local", "imported", "exported"].includes(key) ||
        (key === "key" && parent?.type !== "Computed") ||
        (key === "property" && parent?.type === "MemberExpression");
      if (!binding && globalName(n.value)) {
        if (game && ambient.has(n.value)) fail(`Gameplay uses ambient capability: ${n.value}`);
        if (ui && ["localStorage", "sessionStorage"].includes(n.value))
          fail("UI persistence belongs behind platform preferences or session saves.");
      }
    }
    if (
      n.type.startsWith("Ts") &&
      n.type !== "TsAsExpression" &&
      n.type !== "TsNonNullExpression" &&
      n.type !== "TsSatisfiesExpression"
    )
      return;
    for (const [childKey, value] of Object.entries(n)) {
      if (["span", "ctxt"].includes(childKey)) continue;
      if (Array.isArray(value)) for (const child of value) walk(child, scopes, n, childKey);
      else if (node(value)) walk(value, scopes, n, childKey);
    }
  }
  walk(ast);
  return [...new Set(errors)];
}
export async function checkBoundaries(directory = "src") {
  const violations = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.[cm]?[jt]sx?$/.test(file))
        violations.push(...boundaryViolations(file, await readFile(file, "utf8")));
    }
  }
  await walk(directory);
  violations.push(...modifierContractViolations(readModifierSources(process.cwd())));
  if (violations.length) throw new Error(violations.join("\n"));
  console.log("Parser-based architecture boundaries passed.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await checkBoundaries();
