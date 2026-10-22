import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, lstat } from "node:fs/promises";
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
export async function reportDirectory(input, fallback, { root = ROOT } = {}) {
  const directory = path.resolve(root, input ?? fallback);
  if (!directory.startsWith(path.join(root, "reports") + path.sep))
    throw new Error("Reports must remain under reports/.");
  // Check each component before creating children so an existing symlink cannot
  // redirect even mkdir's side effects into another checkout or source tree.
  let current = root;
  for (const component of path.relative(root, directory).split(path.sep)) {
    current = path.join(current, component);
    try {
      await mkdir(current);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const entry = await lstat(current);
    if (!entry.isDirectory() || entry.isSymbolicLink())
      throw new Error("Reports must remain under reports/ without symlink directories.");
  }
  return directory;
}
