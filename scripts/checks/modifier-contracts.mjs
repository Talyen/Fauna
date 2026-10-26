import { parseSync } from "@swc/core";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const bindingFile = "src/game/modifier-bindings.ts";
const groups = ["talents", "boons", "passives"];
const node = (value) => value && typeof value === "object" && typeof value.type === "string";
function walk(value, visit, parent, owner) {
  if (!value || typeof value !== "object") return;
  if (!node(value)) {
    for (const child of Object.values(value))
      if (child && typeof child === "object") walk(child, visit, parent, owner);
    return;
  }
  if (value.type === "FunctionDeclaration" && !owner) owner = value.identifier.value;
  if (
    value.type === "VariableDeclarator" &&
    !owner &&
    ["ArrowFunctionExpression", "FunctionExpression"].includes(value.init?.type)
  )
    owner = value.id.value;
  visit(value, parent, owner);
  for (const [key, child] of Object.entries(value)) {
    if (key === "span" || key === "ctxt") continue;
    if (Array.isArray(child)) for (const entry of child) walk(entry, visit, value, owner);
    else if (node(child)) walk(child, visit, value, owner);
  }
}
const unwrap = (value) =>
  ["TsAsExpression", "TsSatisfiesExpression", "ParenthesisExpression"].includes(value?.type)
    ? unwrap(value.expression)
    : value;
const keyName = (value) => value?.value;
const property = (object, name) =>
  unwrap(object)?.properties?.find((entry) => keyName(entry.key) === name)?.value;
function objectKeys(value) {
  return unwrap(value)?.properties?.map((entry) => keyName(entry.key)) ?? [];
}
function imports(ast, file) {
  const result = new Map();
  for (const declaration of ast.body) {
    if (declaration.type !== "ImportDeclaration" || declaration.typeOnly) continue;
    const target =
      path.posix.normalize(path.posix.join(path.posix.dirname(file), declaration.source.value)) + ".ts";
    for (const specifier of declaration.specifiers) {
      if (specifier.type === "ImportSpecifier" && !specifier.isTypeOnly)
        result.set(specifier.local.value, {
          file: target,
          name: specifier.imported?.value ?? specifier.local.value,
        });
    }
  }
  return result;
}
function declaredObject(ast, name) {
  let result;
  walk(ast, (entry) => {
    if (entry.type === "VariableDeclarator" && entry.id.value === name) {
      const init = unwrap(entry.init);
      result = init?.type === "CallExpression" ? unwrap(init.arguments[0]?.expression) : init;
    }
  });
  return result;
}
function catalogIds(ast, file) {
  const ids = [];
  const moduleImports = imports(ast, file);
  walk(ast, (entry) => {
    if (
      entry.type === "KeyValueProperty" &&
      keyName(entry.key) === "id" &&
      entry.value.type === "StringLiteral"
    )
      ids.push(entry.value.value);
    if (entry.type === "CallExpression" && entry.callee.type === "Identifier") {
      const target = moduleImports.get(entry.callee.value);
      const id = entry.arguments[0]?.expression;
      if (
        target?.file === "src/game/content/talent-builder.ts" &&
        target.name === "talent" &&
        id?.type === "StringLiteral"
      )
        ids.push(id.value);
    }
  });
  return ids;
}

/** Statically tie authored identities to actual functions, without running gameplay or changing dispatch. */
export function modifierContractViolations(sources) {
  if (!sources[bindingFile]) return [`${bindingFile}: Missing modifier implementation contract.`];
  const parsed = Object.fromEntries(
    Object.entries(sources).map(([file, source]) => [
      file,
      parseSync(source, { syntax: "typescript", tsx: file.endsWith(".tsx") }),
    ]),
  );
  const required = { talents: [], boons: [], passives: [] };
  for (const [file, ast] of Object.entries(parsed)) {
    if (file.startsWith("src/game/content/talents/")) required.talents.push(...catalogIds(ast, file));
    if (file === "src/game/content/boons.ts") required.boons.push(...catalogIds(ast, file));
  }
  // Passive fields such as effect/trigger are not passive kinds.
  if (parsed["src/game/content/types.ts"]) {
    walk(parsed["src/game/content/types.ts"], (entry) => {
      if (entry.type !== "TsTypeAliasDeclaration" || entry.id.value !== "PassiveEffect") return;
      walk(entry.typeAnnotation, (field) => {
        if (
          field.type === "TsPropertySignature" &&
          keyName(field.key) === "kind" &&
          field.typeAnnotation?.typeAnnotation?.type === "TsLiteralType"
        )
          required.passives.push(field.typeAnnotation.typeAnnotation.literal.value);
      });
    });
  }
  const errors = [];
  const fail = (message) => errors.push(`${bindingFile}: ${message}`);
  const ast = parsed[bindingFile];
  const owners = new Map();
  const functions = new Map();
  const selectors = new Map();
  const invoked = new Set();
  const identity = (file, name) => `${file}#${name}`;
  function resolvedTarget(file, name, seen = new Set()) {
    const target = identity(file, name);
    if (seen.has(target)) return target;
    seen.add(target);
    for (const declaration of parsed[file]?.body ?? []) {
      if (declaration.type !== "ExportNamedDeclaration" || !declaration.source || declaration.typeOnly)
        continue;
      const specifier = declaration.specifiers.find(
        (entry) => (entry.exported?.value ?? entry.orig?.value) === name,
      );
      if (specifier)
        return resolvedTarget(
          path.posix.normalize(path.posix.join(path.posix.dirname(file), declaration.source.value)) + ".ts",
          specifier.orig.value,
          seen,
        );
    }
    return target;
  }
  for (const [file, module] of Object.entries(parsed)) {
    if (
      file === bindingFile ||
      file.startsWith("src/game/content/") ||
      file === "src/game/content-validation.ts" ||
      file === "src/game/state-schema.ts" ||
      file.startsWith("src/game/rules/")
    )
      continue;
    const moduleImports = imports(module, file);
    const talentSelectors = new Set();
    walk(module, (entry, _parent, owner) => {
      if (entry.type !== "CallExpression" || entry.callee.type !== "Identifier") return;
      const target = moduleImports.get(entry.callee.value);
      if (
        (target?.file === "src/game/progression.ts" && target.name === "hasTalent") ||
        (target?.file === "src/game/rules/talents.ts" && target.name === "talentRule") ||
        (target?.file === "src/game/chance.ts" && target.name === "talentChance")
      )
        talentSelectors.add(owner);
    });
    walk(module, (entry, parent, owner) => {
      if (
        (entry.type === "FunctionDeclaration" && entry.identifier.value === owner) ||
        (entry.type === "VariableDeclarator" && entry.id.value === owner)
      )
        functions.set(identity(file, owner), entry);
      if (entry.type === "CallExpression" && entry.callee.type === "Identifier") {
        const target = moduleImports.get(entry.callee.value);
        invoked.add(resolvedTarget(target?.file ?? file, target?.name ?? entry.callee.value));
      }
      // These are the existing typed scheduler's actual dispatch entries.
      if (
        file === "src/game/combat/resolution.ts" &&
        parent?.type === "ObjectExpression" &&
        entry.type === "Identifier"
      ) {
        const target = moduleImports.get(entry.value);
        if (target) invoked.add(identity(target.file, target.name));
      }
      if (entry.type !== "StringLiteral" || !owner || !file.startsWith("src/game/")) return;
      for (const group of groups) {
        if (!required[group].includes(entry.value)) continue;
        // Repeat/proc tables use a typed local selector; their literals belong to
        // that same function. A descriptive string alone is never an implementation.
        if (group === "talents" && !talentSelectors.has(owner)) continue;
        if (
          group === "boons" &&
          !(
            parent?.type === "CallExpression" &&
            parent.callee.type === "MemberExpression" &&
            parent.callee.property.value === "includes" &&
            parent.callee.object.type === "MemberExpression" &&
            parent.callee.object.property.value === "boons"
          )
        )
          continue;
        if (
          group === "passives" &&
          !(
            parent?.type === "BinaryExpression" &&
            [parent.left, parent.right].some(
              (side) => side?.type === "MemberExpression" && side.property.value === "kind",
            )
          ) &&
          !(
            parent?.type === "CallExpression" &&
            parent.callee.type === "Identifier" &&
            moduleImports.get(parent.callee.value)?.file === "src/game/progression.ts" &&
            moduleImports.get(parent.callee.value)?.name === "passiveAmount" &&
            parent.arguments[2]?.expression === entry
          ) &&
          !(
            parent?.type === "ConditionalExpression" &&
            required.passives.includes(parent.consequent?.value) &&
            required.passives.includes(parent.alternate?.value)
          )
        )
          continue;
        const key = `${group}:${entry.value}`;
        if (!selectors.has(key)) selectors.set(key, new Set());
        selectors.get(key).add(identity(file, owner));
      }
    });
  }
  for (const contract of ["modifierImplementations", "modifierQueries"]) {
    const object = declaredObject(ast, contract);
    if (!object) {
      fail(`Missing ${contract}.`);
      continue;
    }
    for (const group of groups) {
      const entries = unwrap(property(object, group));
      const keys = objectKeys(entries);
      for (const key of keys) {
        if (!required[group].includes(key)) fail(`Unknown ${group} binding: ${key}.`);
        if (keys.filter((other) => other === key).length > 1) fail(`Duplicate ${group} binding: ${key}.`);
        const handlers = unwrap(property(entries, key));
        if (handlers?.type !== "ArrayExpression" || !handlers.elements.length) {
          fail(`${key} needs at least one concrete implementation function.`);
          continue;
        }
        for (const element of handlers.elements) {
          const handler = element?.expression;
          const reference = handler?.type === "StringLiteral" && handler.value.match(/^(\.\/[^#]+)#([^#]+)$/);
          if (!reference) {
            fail(`${key} must bind typed module/export references.`);
            continue;
          }
          const [, module, name] = reference;
          const target = identity(
            path.posix.normalize(path.posix.join(path.posix.dirname(bindingFile), module)) + ".ts",
            name,
          );
          const selectorKey = `${group}:${key}`;
          if (!functions.has(target)) fail(`${key} binds a missing implementation: ${target}.`);
          if (!selectors.get(selectorKey)?.has(target)) fail(`${key} is not implemented/read by ${target}.`);
          if (!invoked.has(target)) fail(`${key} binds ${target}, which has no runtime caller.`);
          if (!owners.has(selectorKey)) owners.set(selectorKey, new Set());
          owners.get(selectorKey).add(target);
        }
      }
      if (contract === "modifierImplementations")
        for (const key of required[group])
          if (!keys.includes(key)) fail(`Missing ${group} implementation: ${key}.`);
    }
  }
  for (const [key, sites] of selectors)
    for (const site of sites)
      if (!owners.get(key)?.has(site)) fail(`${key} has an undeclared owner: ${site}.`);
  return [...new Set(errors)];
}

export function readModifierSources(root) {
  const sources = {};
  function read(dir) {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) read(file);
      else if (file.endsWith(".ts")) sources[file] = readFileSync(path.join(root, file), "utf8");
    }
  }
  read("src/game");
  if (existsSync(path.join(root, "src/application"))) read("src/application");
  return sources;
}
