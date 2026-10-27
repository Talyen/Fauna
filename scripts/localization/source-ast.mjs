export function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const [key, child] of Object.entries(node)) {
    if (key === "span") continue;
    if (Array.isArray(child)) child.forEach((item) => walk(item, visit));
    else if (child && typeof child === "object") walk(child, visit);
  }
}
