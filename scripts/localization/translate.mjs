import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { qualifiedFontIssues } from "./font-coverage.mjs";
import { extractProjectContent } from "./content.mjs";
import { extractProjectMessages } from "./messages.mjs";
import {
  applyPackets,
  mergeSources,
  preparePackets,
  qualificationIssues,
  validateCatalog,
} from "./catalog.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const directory = path.join(root, "src/ui/shared/localization");
const reports = path.join(root, "reports/localization");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const englishFile = path.join(directory, "messages.en.json");
const ui = read(englishFile);
const content = read(path.join(directory, "content.en.json"));
const english = mergeSources(ui, content);
if (
  JSON.stringify(ui) !== JSON.stringify(extractProjectMessages(root)) ||
  JSON.stringify(content) !== JSON.stringify(extractProjectContent(root))
)
  throw new Error("English catalog is stale; run npm run localization:extract first");
const languages = read(path.join(directory, "languages.json"));
const coverage = read(path.join(directory, "coverage.json"));
const locales = Object.keys(languages).filter((locale) => locale !== "en");
const glossaries = read(path.join(directory, "glossary.json"));
const localeDir = path.join(directory, "locales");
const fileFor = (locale) => path.join(localeDir, `${locale}.json`);
const catalogs = Object.fromEntries(
  locales.map((locale) => [locale, fs.existsSync(fileFor(locale)) ? read(fileFor(locale)) : {}]),
);
const serialize = (data) => JSON.stringify(data, null, 2) + "\n";
function backup(file) {
  if (!fs.existsSync(file)) return;
  const copies = path.join(reports, "backups");
  fs.mkdirSync(copies, { recursive: true });
  fs.copyFileSync(
    file,
    path.join(copies, `${path.basename(file)}-${randomUUID()}.bak`),
    fs.constants.COPYFILE_EXCL,
  );
}
function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink())
    throw new Error(`Refusing to replace symlink: ${file}`);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, serialize(data), { flag: "wx" });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
const [command, ...args] = process.argv.slice(2);
const packetFile = path.join(reports, "tasks.json");
if (command === "prepare" && args.length === 0) {
  const previous = fs.existsSync(packetFile) ? read(packetFile) : undefined;
  const packet = preparePackets(english, locales, catalogs, glossaries, previous);
  backup(packetFile);
  writeAtomic(packetFile, packet);
  console.log(
    `Prepared ${packet.locales.reduce((sum, entry) => sum + Object.keys(entry.messages).length, 0)} pending translations in ${packetFile}`,
  );
} else if (command === "apply" && args.length === 1 && args[0] === "--reviewed") {
  const packet = read(packetFile);
  const output = applyPackets(english, locales, catalogs, glossaries, packet);
  const changed = Object.entries(output).filter(
    ([locale, catalog]) => JSON.stringify(catalog) !== JSON.stringify(catalogs[locale]),
  );
  for (const [locale] of changed) backup(fileFor(locale));
  for (const [locale, catalog] of changed) writeAtomic(fileFor(locale), catalog);
  console.log(
    `Applied reviewed translations for ${changed.map(([locale]) => locale).join(", ") || "no locales"}`,
  );
} else if (command === "check" && args.length === 0) {
  const issues = locales.flatMap((locale) =>
    validateCatalog(english, catalogs[locale], locale, glossaries[locale]).map(
      (issue) => `${locale}: ${issue}`,
    ),
  );
  issues.push(...qualificationIssues(languages, coverage, english, catalogs, glossaries));
  issues.push(
    ...qualifiedFontIssues(languages, catalogs, (file) => {
      const font = path.join(root, "src/assets/fonts", file);
      return fs.existsSync(font) ? fs.readFileSync(font) : null;
    }),
  );
  if (issues.length) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
  } else console.log("Reviewed translation records are current");
} else throw new Error("Use prepare, apply --reviewed, or check");
