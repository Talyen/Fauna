import { createHash } from "node:crypto";

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sorted(item)]),
    );
  return value;
}
export function sourceHash(locale, source, glossary) {
  return createHash("sha256")
    .update(JSON.stringify(sorted({ locale, source, glossary })))
    .digest("hex");
}
function params(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  if (/\{\{|\}\}/.test(text.replace(/\{\{[a-zA-Z][\w]*\}\}/g, ""))) return null;
  return [...new Set([...text.matchAll(/\{\{([a-zA-Z][\w]*)\}\}/g)].map((match) => match[1]))]
    .sort()
    .join(",");
}

/** Structural and freshness checks do not establish translation quality. */
export function validateCatalog(english, translations, locale, glossary, complete = false) {
  const issues = [];
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  for (const id of Object.keys(translations))
    if (!Object.hasOwn(english, id)) issues.push(`${id}: unknown message`);
  for (const [id, source] of Object.entries(english)) {
    const entry = Object.hasOwn(translations, id) ? translations[id] : undefined;
    if (!entry) {
      if (complete) issues.push(`${id}: missing translation`);
      continue;
    }
    const expectedSource = Object.hasOwn(source, "text") ? source.text : source.forms;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push(`${id}: invalid translation record`);
      continue;
    }
    if (
      JSON.stringify(sorted(entry.source)) !== JSON.stringify(sorted(expectedSource)) ||
      entry.sourceHash !== sourceHash(locale, source, glossary)
    )
      issues.push(`${id}: stale source or glossary`);
    if (entry.reviewed !== true) issues.push(`${id}: not reviewed`);
    if (Object.hasOwn(source, "text")) {
      if (
        params(entry.text) === null ||
        params(entry.text) !== params(source.text) ||
        Object.hasOwn(entry, "forms")
      )
        issues.push(`${id}: invalid text or parameters`);
    } else {
      const forms = entry.forms;
      if (!forms || typeof forms !== "object" || Array.isArray(forms) || Object.hasOwn(entry, "text")) {
        issues.push(`${id}: invalid plural forms`);
        continue;
      }
      for (const category of categories)
        if (params(forms[category]) === null || params(forms[category]) !== params(source.forms.other))
          issues.push(`${id}: missing or invalid ${category} plural form`);
      for (const category of Object.keys(forms))
        if (!categories.includes(category)) issues.push(`${id}: unsupported ${category} plural form`);
    }
  }
  return issues;
}

/** Build editable work while retaining drafts only when source and glossary still match. */
export function preparePackets(english, locales, catalogs, glossaries, previous) {
  if (previous !== undefined && (previous?.version !== 1 || !Array.isArray(previous.locales)))
    throw new Error("Existing translation packet is invalid; preserve it and choose another path");
  const prior = new Map();
  for (const packet of previous?.locales ?? []) {
    if (!locales.includes(packet.locale) || prior.has(packet.locale) || !packet.messages || !packet.results)
      throw new Error("Existing translation packet contains invalid locale data");
    prior.set(packet.locale, packet);
  }
  const packets = [];
  for (const locale of locales) {
    const messages = {};
    const results = {};
    const glossary = glossaries[locale];
    if (!glossary || typeof glossary !== "object" || Array.isArray(glossary))
      throw new Error(`${locale}: missing glossary`);
    for (const [id, source] of Object.entries(english)) {
      const existing = catalogs[locale]?.[id];
      if (existing && validateCatalog({ [id]: source }, { [id]: existing }, locale, glossary).length === 0)
        continue;
      const hash = sourceHash(locale, source, glossary);
      messages[id] = { source, sourceHash: hash, ...(existing ? { prior: existing } : {}) };
      const old = prior.get(locale);
      const draft = old?.messages?.[id]?.sourceHash === hash ? old?.results?.[id] : null;
      if (draft !== null && draft !== undefined && (typeof draft !== "object" || Array.isArray(draft)))
        throw new Error(`${locale} ${id}: invalid existing draft`);
      results[id] = draft ?? null;
    }
    if (Object.keys(messages).length) packets.push({ locale, glossary, messages, results });
  }
  return { version: 1, locales: packets };
}

/** Validate the entire packet before producing replacement catalogs. */
export function applyPackets(english, locales, catalogs, glossaries, packet) {
  if (packet?.version !== 1 || !Array.isArray(packet.locales)) throw new Error("Invalid translation packet");
  const output = {};
  const seen = new Set();
  for (const batch of packet.locales) {
    const locale = batch.locale;
    if (!locales.includes(locale) || seen.has(locale) || !batch.messages || !batch.results)
      throw new Error("Invalid or duplicate packet locale");
    seen.add(locale);
    if (JSON.stringify(sorted(batch.glossary)) !== JSON.stringify(sorted(glossaries[locale])))
      throw new Error(`${locale}: glossary changed; prepare a fresh packet`);
    const next = { ...catalogs[locale] };
    for (const id of Object.keys(batch.results))
      if (!Object.hasOwn(batch.messages, id))
        throw new Error(`${locale} ${id}: result has no prepared message`);
    for (const [id, item] of Object.entries(batch.messages)) {
      const source = english[id];
      if (
        !source ||
        JSON.stringify(sorted(item.source)) !== JSON.stringify(sorted(source)) ||
        item.sourceHash !== sourceHash(locale, source, glossaries[locale])
      )
        throw new Error(`${locale} ${id}: source changed; prepare a fresh packet`);
      if (!Object.hasOwn(batch.results, id)) throw new Error(`${locale} ${id}: missing result field`);
      const result = batch.results[id];
      if (result === null) continue;
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error(`${locale} ${id}: invalid result`);
      const field = Object.hasOwn(source, "text") ? "text" : "forms";
      if (Object.keys(result).join(",") !== field)
        throw new Error(`${locale} ${id}: result must contain only ${field}`);
      const entry = {
        source: source.text ?? source.forms,
        sourceHash: item.sourceHash,
        reviewed: true,
        [field]: result[field],
      };
      const issues = validateCatalog({ [id]: source }, { [id]: entry }, locale, glossaries[locale], true);
      if (issues.length) throw new Error(`${locale}: ${issues.join("; ")}`);
      next[id] = entry;
    }
    output[locale] = sorted(next);
  }
  return output;
}

/** A partial source inventory can never qualify a language for players. */
export function qualificationIssues(languages, coverage, english, catalogs, glossaries) {
  const issues = [];
  if (languages.en?.qualified !== true) issues.push("English must remain qualified");
  for (const name of ["ui", "content", "rules", "runtime"])
    if (typeof coverage?.[name] !== "boolean") issues.push(`Invalid ${name} coverage status`);
  for (const [locale, config] of Object.entries(languages)) {
    if (typeof config?.qualified !== "boolean") {
      issues.push(`${locale}: invalid qualification status`);
      continue;
    }
    if (locale === "en" || !config.qualified) continue;
    if (!["ui", "content", "rules", "runtime"].every((name) => coverage?.[name] === true))
      issues.push(`${locale}: source migration is incomplete`);
    for (const issue of validateCatalog(english, catalogs[locale] ?? {}, locale, glossaries[locale], true))
      issues.push(`${locale}: ${issue}`);
  }
  return issues;
}

export function mergeSources(...catalogs) {
  const merged = {};
  for (const catalog of catalogs)
    for (const [id, message] of Object.entries(catalog)) {
      if (Object.hasOwn(merged, id)) throw new Error(`Duplicate source message ID: ${id}`);
      merged[id] = message;
    }
  return sorted(merged);
}
