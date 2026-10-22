import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { assets } from "./assets.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
export async function artReview(repository = root) {
  const receipt = await assets({ repository });
  const manifest = JSON.parse(await readFile(path.join(repository, "assets/manifest.json"), "utf8"));
  const rows = [];
  const tiles = [];
  let sourceBytes = 0,
    outputBytes = 0;
  for (const entry of manifest.assets.filter((item) => item.kind === "art")) {
    const record = receipt.records[entry.id];
    sourceBytes += record.sourceBytes;
    outputBytes += record.outputBytes;
    const file = path.join(repository, "public", record.url.slice(2));
    const source = entry.origin === "repository" ? path.join(repository, entry.source) : undefined;
    const image = (filename) =>
      `<img src="${escape(pathToFileURL(filename).href)}" alt="${escape(entry.id)}">`;
    rows.push(
      `<section><h2>${escape(entry.id)}</h2><p>${record.width} × ${record.height}; ${(record.sourceBytes / 1024).toFixed(1)} → ${(record.outputBytes / 1024).toFixed(1)} KiB${entry.recipe === "copy" ? "; unchanged source" : "; lossless WebP; up to 480 CSS px at 2×"}</p><div>${source ? `<figure>${image(source)}<figcaption>Original</figcaption></figure>` : ""}<figure>${image(file)}<figcaption>Prepared</figcaption></figure></div></section>`,
    );
    // The contact sheet samples every newly encoded selection at card size.
    if (entry.recipe === "card-webp")
      tiles.push(
        await sharp(file).resize(240, 240, { fit: "contain", background: "#11100f" }).png().toBuffer(),
      );
  }
  const directory = path.join(repository, "reports/art-review");
  await mkdir(directory, { recursive: true });
  if (tiles.length)
    await sharp({
      create: {
        width: 240 * 4,
        height: 240 * Math.ceil(tiles.length / 4),
        channels: 3,
        background: "#11100f",
      },
    })
      .composite(
        tiles.map((input, index) => ({ input, left: (index % 4) * 240, top: Math.floor(index / 4) * 240 })),
      )
      .png()
      .toFile(path.join(directory, "contact-sheet.png"));
  const summary = { generation: receipt.generation, sourceBytes, outputBytes, artSelections: rows.length };
  await writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  await writeFile(
    path.join(directory, "index.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Fauna artwork preparation review</title><style>body{background:#11100f;color:#eee;font:16px system-ui;margin:24px}section{margin:24px 0}section>div{display:flex;gap:24px}figure{margin:0}img{width:480px;height:480px;object-fit:contain}figcaption{margin:12px 0}</style><h1>Artwork preparation review</h1><p>Original and prepared images at up to 480 CSS pixels; review at 2× display density. ${(sourceBytes / 1048576).toFixed(2)} → ${(outputBytes / 1048576).toFixed(2)} MiB. Existing small sources are preserved; preparation cannot add missing detail.</p>${rows.join("\n")}</html>`,
  );
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error("Usage: npm run assets:review");
  console.log(await artReview());
  console.log(
    "Review reports/art-review/index.html and contact-sheet.png; this does not establish in-game rendered acceptance.",
  );
}
