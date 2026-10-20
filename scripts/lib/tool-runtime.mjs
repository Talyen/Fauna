import { createHash } from "node:crypto";
import { readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
export const ROOT = path.resolve(import.meta.dirname, "../..");
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export async function identity() {
  const digest = createHash("sha256");
  async function walk(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else {
        digest.update(path.relative(ROOT, file));
        digest.update(await readFile(file));
      }
    }
  }
  await walk(path.join(ROOT, "src/game"));
  await walk(path.join(ROOT, "src/application"));
  return digest.digest("hex");
}
export async function runtime() {
  const { createServer } = await import("vite");
  return createServer({
    root: ROOT,
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
  });
}
export async function reportDirectory(input, fallback) {
  const directory = path.resolve(ROOT, input ?? fallback);
  if (!directory.startsWith(path.join(ROOT, "reports") + path.sep))
    throw new Error("Reports must remain under reports/.");
  await mkdir(directory, { recursive: true });
  return directory;
}
