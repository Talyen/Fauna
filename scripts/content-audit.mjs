import { createServer } from "vite";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { assets } from "./assets.mjs";
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { validateCatalog, contentCatalog } = await server.ssrLoadModule("/src/game/content-validation.ts");
  const issues = validateCatalog();
  const receipt = await assets();
  const manifest = JSON.parse(await readFile("assets/manifest.json", "utf8"));
  const requireAsset = (id) => {
    if (!Object.hasOwn(receipt.records, id))
      issues.push({ severity: "error", id, field: "artwork", message: "Missing registered media." });
  };
  for (const species of contentCatalog.species) {
    requireAsset(`creature.${species.id}`);
    requireAsset(`action.${species.id}`);
  }
  for (const kind of ["combat", "boss"]) requireAsset(`encounter.${kind}`);
  // Keyword tabs use text; illustrations are optional selections, not a talent prerequisite.
  for (const entry of manifest.assets.filter((asset) => asset.id.startsWith("keyword.")))
    requireAsset(entry.id);
  for (const boon of contentCatalog.boons) requireAsset(`boon.${boon.id}`);
  requireAsset("pile.placeholder");
  requireAsset("mana.full");
  requireAsset("mana.empty");
  for (const cue of [
    "physical",
    "fire",
    "ice",
    "lightning",
    "poison",
    "nature",
    "light",
    "heal",
    "block",
    "absorb",
    "deny",
    "victory",
    "defeat",
    "recruit",
    "talent",
    "knockout",
  ]) {
    const entry = manifest.assets.find((asset) => asset.id === `sound.${cue}`);
    if (!entry || entry.kind !== "sound")
      issues.push({
        severity: "error",
        id: cue,
        field: "sound",
        message: "Missing focal sound registration.",
      });
  }
  await mkdir("reports", { recursive: true });
  await writeFile("reports/content-audit.json", JSON.stringify(issues, null, 2));
  for (const issue of issues) console.log(`${issue.severity}: ${issue.id}.${issue.field}: ${issue.message}`);
  console.log(
    `${issues.filter((issue) => issue.severity === "error").length} errors, ${issues.filter((issue) => issue.severity === "warning").length} warnings`,
  );
  if (issues.some((issue) => issue.severity === "error")) process.exitCode = 1;
} finally {
  await server.close();
}
