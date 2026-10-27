import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { FONT_REQUIREMENTS, fontHasGlyph, requiredFontText, verifiedFontSource } from "./font-coverage.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--source-dir"))
  throw new Error("Usage: npm run localization:fonts -- [--source-dir <original-font-directory>]");
const python = process.env.FAUNA_FONT_PYTHON ?? "python3";
const version = execFileSync(python, ["-c", "import fontTools; print(fontTools.__version__)"], {
  encoding: "utf8",
}).trim();
if (version !== "4.60.1") throw new Error("Font regeneration requires fonttools==4.60.1");
const directory = path.join(root, "src/ui/shared/localization");
const languages = JSON.parse(fs.readFileSync(path.join(directory, "languages.json"), "utf8"));
const catalogs = Object.fromEntries(
  Object.keys(FONT_REQUIREMENTS).map((locale) => {
    const file = path.join(directory, "locales", `${locale}.json`);
    return [locale, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}];
  }),
);
const sourceDirectory = args[1]
  ? path.resolve(args[1])
  : path.join(root, "reports/localization/font-sources");
fs.mkdirSync(sourceDirectory, { recursive: true });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "fauna-fonts-"));
try {
  const generated = [];
  for (const [locale, requirement] of Object.entries(FONT_REQUIREMENTS)) {
    const source = path.join(sourceDirectory, requirement.file);
    if (!fs.existsSync(source) && !args[1]) {
      const response = await fetch(requirement.url);
      if (!response.ok) throw new Error(`Font source download failed: ${response.status}`);
      fs.writeFileSync(source, Buffer.from(await response.arrayBuffer()), { flag: "wx" });
    }
    const bytes = fs.readFileSync(source);
    if (!verifiedFontSource(bytes, requirement.sha256))
      throw new Error(`Font source digest differs: ${source}`);
    const text = requiredFontText(locale, languages, catalogs);
    const characters = [...new Set(text.match(requirement.pattern) ?? [])];
    const missing = characters.filter((character) => !fontHasGlyph(bytes, character.codePointAt(0)));
    if (missing.length) throw new Error(`${requirement.file} lacks ${missing.join("")}`);
    const unicodes = [
      "U+0000-024F",
      "U+2000-206F",
      "U+20A0-20CF",
      "U+2190-21FF",
      ...characters.map((character) => `U+${character.codePointAt(0).toString(16)}`),
    ].join(",");
    const output = path.join(temporary, requirement.file);
    execFileSync(
      python,
      [
        "-m",
        "fontTools.subset",
        source,
        `--output-file=${output}`,
        `--unicodes=${unicodes}`,
        "--layout-features=*",
        "--name-IDs=*",
        "--name-languages=*",
        "--notdef-outline",
        "--no-recalc-timestamp",
        "--canonical-order",
      ],
      { stdio: "inherit" },
    );
    const subset = fs.readFileSync(output);
    if (characters.some((character) => !fontHasGlyph(subset, character.codePointAt(0))))
      throw new Error(`Subset lost required glyphs: ${requirement.file}`);
    generated.push({ file: requirement.file, subset });
  }
  const destination = path.join(root, "src/assets/fonts"),
    backups = path.join(root, "reports/localization/backups");
  fs.mkdirSync(destination, { recursive: true });
  for (const { file, subset } of generated) {
    const target = path.join(destination, file);
    if (fs.lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink())
      throw new Error(`Refusing to replace symlink: ${target}`);
    if (fs.existsSync(target)) {
      fs.mkdirSync(backups, { recursive: true });
      fs.copyFileSync(target, path.join(backups, `${file}-${randomUUID()}.bak`), fs.constants.COPYFILE_EXCL);
    }
    const staged = path.join(destination, `.${file}-${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(staged, subset, { flag: "wx" });
      fs.renameSync(staged, target);
    } finally {
      if (fs.existsSync(staged)) fs.unlinkSync(staged);
    }
    console.log(`${file}: ${subset.length.toLocaleString("en")} bytes`);
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
