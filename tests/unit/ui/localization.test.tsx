// @vitest-environment jsdom
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  applyPackets,
  mergeSources,
  preparePackets,
  qualificationIssues,
  sourceHash,
  validateCatalog,
} from "../../../scripts/localization/catalog.mjs";
import { extractPassiveRules } from "../../../scripts/localization/passive-rules.mjs";
import { extractTalentRules } from "../../../scripts/localization/talent-rules.mjs";
import { extractBoonRules } from "../../../scripts/localization/boon-rules.mjs";
import { BOONS, TALENTS, SPECIES } from "../../../src/game/content";
import { BoonName, BoonText } from "../../../src/ui/expedition/boon-presentation";
import { ruleMessage } from "../../../src/ui/shared/localization/rule-message";
import { extractContent } from "../../../scripts/localization/content.mjs";
import { extractMessages } from "../../../scripts/localization/messages.mjs";
import { produce } from "immer";
import { App } from "../../../src/ui/App";
import { createSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import french from "../../../src/ui/shared/localization/locales/fr.json";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { Keyword } from "../../../src/ui/shared/keyword-text";
import { CreatureCard } from "../../../src/ui/shared/cards/cards";
import { ActionDetails, CreatureDetails } from "../../../src/ui/shared/cards/card-details";
import { ReplacementPicker } from "../../../src/ui/shared/cards/roster-picker";
import { addBackups, requireBattle, run, teamRun } from "../../support/game";
import { BattleScreen } from "../../../src/ui/battle/battle-screen";
import { ManaCrystals } from "../../../src/ui/battle/mana-crystals";
import { MenuActions } from "../../../src/ui/menu/menu-actions";
import { resolveLanguage, type GameLocale } from "../../../src/ui/shared/localization/languages";
import { LocalizationProvider, useLanguage } from "../../../src/ui/shared/localization/provider";
import { useMessages, MessageProvider } from "../../../src/ui/shared/localization/message-context";
import { createMessageReader, type MessageCatalog } from "../../../src/ui/shared/localization/messages";

it("selects locale plural forms and falls back when source or placeholders are stale", () => {
  const source = { one: "{{count}} talent point available", other: "{{count}} talent points available" };
  const reader = createMessageReader("ru", {
    points: {
      source,
      forms: {
        one: "{{count}} очко",
        few: "{{count}} очка",
        many: "{{count}} очков",
        other: "{{count}} очка",
      },
    },
    greeting: { source: "Hello {{name}}", text: "Привет {{name}}" },
    stale: { source: "Old {{name}}", text: "Старое {{name}}" },
    broken: { source: "Hello {{name}}", text: "Привет {{person}}" },
  });
  expect([1, 2, 5].map((count) => reader.plural("points", source, count))).toEqual([
    "1 очко",
    "2 очка",
    "5 очков",
  ]);
  expect(reader.message("greeting", "Hello {{name}}", { name: "Fauna" })).toBe("Привет Fauna");
  expect(reader.message("stale", "New {{name}}", { name: "Fauna" })).toBe("New Fauna");
  expect(reader.message("broken", "Hello {{name}}", { name: "Fauna" })).toBe("Hello Fauna");
  expect(reader.plural("points", { ...source, other: "{{count}} new points" }, 2)).toBe("2 new points");
});

it("changes menu messages and accessible counts without replacing the focused action", () => {
  const actions = {
    home: true,
    active: false,
    hasBoons: false,
    talentPoints: 2,
    desktop: false,
    closing: false,
    onContinue: vi.fn(),
    onBoons: vi.fn(),
    onNavigate: vi.fn(),
    onEndJourney: vi.fn(),
    onHome: vi.fn(),
    onQuit: vi.fn(),
  };
  const source = { one: "{{count}} talent point available", other: "{{count}} talent points available" };
  const catalog: MessageCatalog = {
    "menu.play": { source: "Play", text: "Jouer" },
    "menu.talents": { source: "Talents", text: "Talents FR" },
    "menu.talentPoints": {
      source,
      forms: { one: "{{count}} point disponible", other: "{{count}} points disponibles" },
    },
  };
  const view = render(
    <MessageProvider locale="en" catalog={{}}>
      <MenuActions {...actions} />
    </MessageProvider>,
  );
  const button = screen.getByRole("button", { name: "Play" });
  button.focus();
  view.rerender(
    <MessageProvider locale="fr" catalog={catalog}>
      <MenuActions {...actions} />
    </MessageProvider>,
  );
  expect(screen.getByRole("button", { name: "Jouer" })).toBe(button);
  expect(document.activeElement).toBe(button);
  expect(screen.getByLabelText("2 points disponibles")).toBeTruthy();
  fireEvent.click(button);
  expect(actions.onContinue).toHaveBeenCalledOnce();
  view.unmount();
});

it("extracts stable source messages and rejects conflicts or invalid plural parameters", () => {
  const file = (source: string) => ({ location: "screen.tsx", source });
  expect(
    extractMessages([
      file(
        'i18n.message("screen.start", "Start"); i18n.plural("screen.items", {one:"{{count}} item", other:"{{count}} items"}, n);',
      ),
    ]),
  ).toEqual({
    "screen.items": { forms: { one: "{{count}} item", other: "{{count}} items" } },
    "screen.start": { text: "Start" },
  });
  expect(() =>
    extractMessages([file('i18n.message("screen.start", "Start"); i18n.message("screen.start", "Go");')]),
  ).toThrow("conflicting English source");
  expect(() =>
    extractMessages([file('i18n.plural("screen.items", {one:"{{count}} item", other:"items"}, n);')]),
  ).toThrow("same named parameters");
  expect(() => extractMessages([file('i18n.message("screen.start", "Hello {{name}");')])).toThrow(
    "malformed localization parameter",
  );
});

it("selects only qualified languages, with manual and Steam preferences before system locales", () => {
  const ready: GameLocale[] = ["en", "de", "zh-Hans", "ru", "es", "pt-BR", "ja", "fr"];
  expect(resolveLanguage("auto", "german", ["ja-JP"], ready)).toBe("de");
  expect(resolveLanguage("fr", "german", ["ja-JP"], ready)).toBe("fr");
  expect(resolveLanguage("auto", null, ["zh-TW", "zh-CN"], ready)).toBe("zh-Hans");
  expect(resolveLanguage("auto", null, ["es-MX", "pt-PT", "pt-BR"], ready)).toBe("pt-BR");
  expect(resolveLanguage("auto", "japanese", ["ja-JP"])).toBe("en");
  expect(resolveLanguage("ja", null, ["ja-JP"])).toBe("en");
  expect(resolveLanguage("auto", "unknown", ["fr-CA"], ready)).toBe("fr");
});

it("keeps replacement choices addressable when their accessible label is translated", () => {
  const game = produce(run(), (draft) => {
    addBackups(draft, { ...draft.team[0]!, id: "reserve", species: "reedstag", health: 10 });
  });
  const catalog: MessageCatalog = { "replacement.backup": { source: "Backup", text: "Réserve" } };
  const view = render(
    <MessageProvider locale="fr" catalog={catalog}>
      <TooltipProvider>
        <ReplacementPicker game={game} outgoing={game.team[0]!} send={() => true} />
      </TooltipProvider>
    </MessageProvider>,
  );
  const section = screen.getByRole("region", { name: "Réserve" });
  expect(section.matches("[data-replacement-choices]")).toBe(true);
  expect(section.querySelector("button")).not.toBeNull();
  view.unmount();
});

it("validates translation freshness, terminology, placeholders, review and locale plural categories", () => {
  const english = {
    "menu.play": { text: "Play {{name}}" },
    "menu.points": { forms: { one: "{{count}} point", other: "{{count}} points" } },
  };
  const glossary = { point: "очко" };
  const entries = {
    "menu.play": {
      source: english["menu.play"].text,
      sourceHash: sourceHash("ru", english["menu.play"], glossary),
      reviewed: true,
      text: "Играть {{name}}",
    },
    "menu.points": {
      source: english["menu.points"].forms,
      sourceHash: sourceHash("ru", english["menu.points"], glossary),
      reviewed: true,
      forms: {
        one: "{{count}} очко",
        few: "{{count}} очка",
        many: "{{count}} очков",
        other: "{{count}} очка",
      },
    },
  };
  expect(validateCatalog(english, entries, "ru", glossary, true)).toEqual([]);
  expect(validateCatalog(english, entries, "ru", { point: "балл" }, true)).toContain(
    "menu.play: stale source or glossary",
  );
  expect(
    validateCatalog(
      english,
      { ...entries, "menu.play": { ...entries["menu.play"], reviewed: false, text: "Играть {{other}}" } },
      "ru",
      glossary,
      true,
    ),
  ).toEqual(expect.arrayContaining(["menu.play: not reviewed", "menu.play: invalid text or parameters"]));
  const { few: _few, ...incomplete } = entries["menu.points"].forms;
  expect(
    validateCatalog(
      english,
      { ...entries, "menu.points": { ...entries["menu.points"], forms: incomplete } },
      "ru",
      glossary,
      true,
    ),
  ).toContain("menu.points: missing or invalid few plural form");
  expect(validateCatalog(english, {}, "ru", glossary, true)).toEqual([
    "menu.play: missing translation",
    "menu.points: missing translation",
  ]);
});

it("preserves matching drafts and refuses stale or invalid batches before applying translations", () => {
  const english = { "menu.play": { text: "Play {{name}}" } };
  const glossaries = { fr: { play: "jouer" } };
  type Packet = {
    version: number;
    locales: Array<{
      locale: string;
      messages: Record<string, { sourceHash: string }>;
      results: Record<string, null | { text: string }>;
    }>;
  };
  const prepared = preparePackets(english, ["fr"], {}, glossaries) as Packet;
  prepared.locales[0]!.results["menu.play"] = { text: "Jouer {{name}}" };
  const refreshed = preparePackets(english, ["fr"], {}, glossaries, prepared) as Packet;
  expect(refreshed.locales[0]!.results["menu.play"]).toEqual({ text: "Jouer {{name}}" });
  const applied = applyPackets(english, ["fr"], {}, glossaries, refreshed);
  expect(validateCatalog(english, applied.fr!, "fr", glossaries.fr, true)).toEqual([]);
  expect(() =>
    applyPackets({ "menu.play": { text: "Play with {{name}}" } }, ["fr"], {}, glossaries, refreshed),
  ).toThrow("source changed");
  expect(() => applyPackets(english, ["fr"], {}, { fr: { play: "partie" } }, refreshed)).toThrow(
    "glossary changed",
  );
  refreshed.locales[0]!.results["menu.play"] = { text: "Jouer {{other}}" };
  expect(() => applyPackets(english, ["fr"], {}, glossaries, refreshed)).toThrow(
    "invalid text or parameters",
  );
  const changed = preparePackets(english, ["fr"], {}, { fr: { play: "partie" } }, refreshed) as Packet;
  expect(changed.locales[0]!.results["menu.play"]).toBeNull();
});

it("refuses to qualify a language before complete source migration and reviewed translations", () => {
  const english = { "menu.play": { text: "Play" } };
  const languages = { en: { qualified: true }, fr: { qualified: true } };
  const coverage = { ui: false, content: false, rules: false, runtime: false };
  expect(qualificationIssues(languages, coverage, english, {}, { fr: {} })).toEqual([
    "fr: source migration is incomplete",
    "fr: menu.play: missing translation",
  ]);
  expect(
    qualificationIssues({ ...languages, fr: { qualified: false } }, coverage, english, {}, { fr: {} }),
  ).toEqual([]);
});

function LanguageProbe() {
  const language = useLanguage();
  const i18n = useMessages();
  return (
    <>
      <output aria-label="locale">{language.locale}</output>
      <span>{i18n.message("menu.play", "Play")}</span>
      <button onClick={() => language.setPreference("fr")}>French</button>
      <button onClick={() => language.setPreference("ja")}>Japanese</button>
    </>
  );
}

it("persists a qualified language locally and never selects an unavailable catalog", () => {
  localStorage.removeItem("fauna.language.v1");
  const catalog: MessageCatalog = { "menu.play": { source: "Play", text: "Jouer" } };
  const props = {
    catalogs: { fr: catalog },
    qualified: ["en", "fr", "ja"] as GameLocale[],
    systemLanguages: ["en-US"],
  };
  const view = render(
    <LocalizationProvider {...props}>
      <LanguageProbe />
    </LocalizationProvider>,
  );
  expect(screen.getByLabelText("locale").textContent).toBe("en");
  fireEvent.click(screen.getByRole("button", { name: "Japanese" }));
  expect(screen.getByLabelText("locale").textContent).toBe("en");
  fireEvent.click(screen.getByRole("button", { name: "French" }));
  expect(screen.getByLabelText("locale").textContent).toBe("fr");
  expect(screen.getByText("Jouer")).toBeTruthy();
  expect(document.documentElement.lang).toBe("fr");
  expect(localStorage.getItem("fauna.language.v1")).toBe("fr");
  view.unmount();
  const reopened = render(
    <LocalizationProvider {...props}>
      <LanguageProbe />
    </LocalizationProvider>,
  );
  expect(screen.getByLabelText("locale").textContent).toBe("fr");
  reopened.unmount();
  localStorage.removeItem("fauna.language.v1");
});

it("a late Steam response cannot override a manual language choice", async () => {
  localStorage.removeItem("fauna.language.v1");
  let resolveSteam!: (value: string | null) => void;
  const steamLanguage = () =>
    new Promise<string | null>((resolve) => {
      resolveSteam = resolve;
    });
  const props = {
    catalogs: { fr: {}, de: {} },
    qualified: ["en", "fr", "de"] as GameLocale[],
    systemLanguages: ["en"],
    steamLanguage,
  };
  const view = render(
    <LocalizationProvider {...props}>
      <LanguageProbe />
    </LocalizationProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole("button", { name: "French" }));
  await act(async () => {
    resolveSteam("german");
    await Promise.resolve();
  });
  expect(screen.getByLabelText("locale").textContent).toBe("fr");
  view.unmount();
  localStorage.removeItem("fauna.language.v1");
});

it("keeps play usable when optional language storage or Steam access fails", async () => {
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("unavailable");
  });
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("unavailable");
  });
  const steamLanguage = () => {
    throw new Error("Steam unavailable");
  };
  const view = render(
    <LocalizationProvider
      catalogs={{ fr: {} }}
      qualified={["en", "fr"]}
      systemLanguages={["en"]}
      steamLanguage={steamLanguage}
    >
      <LanguageProbe />
    </LocalizationProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole("button", { name: "French" }));
  expect(screen.getByLabelText("locale").textContent).toBe("fr");
  view.unmount();
  read.mockRestore();
  write.mockRestore();
});

it("keeps Steam Cloud usable when optional language replies are malformed or time out", async () => {
  const { createSteam } = createRequire(import.meta.url)("../../../desktop/steam.cjs");
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-language-"));
  vi.stubEnv("FAUNA_STEAM_APP_ID", "480");
  let languageMode = "invalid";
  let timedOutId = 0;
  const worker = Object.assign(new EventEmitter(), {
    kill: vi.fn(),
    postMessage: ({ id, operation }: { id: number; operation: string }) => {
      if (operation === "language" && languageMode === "timeout") {
        timedOutId = id;
        return;
      }
      void Promise.resolve().then(() =>
        worker.emit("message", {
          id,
          value:
            operation === "init"
              ? "76561190000000000"
              : operation === "language"
                ? "not a valid language!"
                : [],
        }),
      );
    },
  });
  let adapter: Awaited<ReturnType<typeof createSteam>> | undefined;
  try {
    adapter = await createSteam({
      app: { isPackaged: false },
      directory,
      isolated: false,
      pause() {},
      utilityProcess: { fork: () => worker },
      loadBinding: () => ({ createOverlay: () => ({ account: "76561190000000000", disconnect() {} }) }),
    });
    expect(await adapter!.language()).toBeNull();
    expect(worker.kill).not.toHaveBeenCalled();
    expect(await adapter!.list()).toEqual([]);
    languageMode = "timeout";
    vi.useFakeTimers();
    const pending = adapter!.language();
    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toBeNull();
    worker.emit("message", { id: timedOutId, value: "german" });
    expect(worker.kill).not.toHaveBeenCalled();
    expect(await adapter!.list()).toEqual([]);
  } finally {
    vi.useRealTimers();
    await adapter?.dispose();
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
});

it("updates the battle mana announcement while preserving the same interactive control", () => {
  const catalog: MessageCatalog = {
    "battle.mana": { source: "Mana {{mana}} of {{maximum}}", text: "Mana {{mana}} sur {{maximum}}" },
  };
  const view = render(
    <MessageProvider locale="en" catalog={{}}>
      <ManaCrystals mana={3} maximum={4} />
    </MessageProvider>,
  );
  const control = screen.getByRole("button", { name: "Mana 3 of 4" });
  control.focus();
  view.rerender(
    <MessageProvider locale="fr" catalog={catalog}>
      <ManaCrystals mana={3} maximum={4} />
    </MessageProvider>,
  );
  expect(screen.getByRole("button", { name: "Mana 3 sur 4" })).toBe(control);
  expect(document.activeElement).toBe(control);
  view.unmount();
});

it("translates a battle targeting prompt without issuing a gameplay command", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const game = produce(teamRun(7, ["prismram", "emberback", "pollenmoth"]), (draft) => {
    draft.battle!.hand = draft.cards.map((card) => card.id);
    draft.battle!.draw = [];
    draft.battle!.mana = 4;
  });
  const catalog: MessageCatalog = {
    "battle.chooseEnemy": { source: "Choose an enemy", text: "Choisir un ennemi" },
    "battle.targetSummary": { source: "{{owner}} · {{target}}", text: "{{target}} · {{owner}}" },
  };
  const send = vi.fn(() => true);
  const view = render(
    <MessageProvider locale="fr" catalog={catalog}>
      <TooltipProvider>
        <BattleScreen
          game={requireBattle(game)}
          send={send}
          controls={{ current: null }}
          bursts={[]}
          controller={false}
          navigateFocus={false}
          onDenied={() => {}}
        />
      </TooltipProvider>
    </MessageProvider>,
  );
  try {
    const attack = view.container.querySelector<HTMLButtonElement>('.hand [data-effect="attack"]');
    expect(attack).not.toBeNull();
    fireEvent.click(attack!);
    expect(screen.getByText("Choisir un ennemi · Prismram")).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    vi.unstubAllGlobals();
  }
});

it("changes language from Settings and returns focus without changing the journey", async () => {
  localStorage.removeItem("fauna.language.v1");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const rects = vi
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  const mediaPlay = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const mediaPause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const mediaLoad = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const session = createSession(createBrowserPlatform(), 7);
  await session.load();
  const before = session.store.getState().game;
  const view = render(
    <LocalizationProvider catalogs={{ fr: french }} qualified={["en", "fr"]} systemLanguages={["en"]}>
      <App session={session} />
    </LocalizationProvider>,
  );
  try {
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const opener = screen.getByRole("button", { name: "Language: Automatic" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Language" });
    expect(dialog).toBeTruthy();
    const frenchChoice = screen.getByRole("radio", { name: "Français" });
    frenchChoice.focus();
    fireEvent.keyDown(frenchChoice, { key: "Enter" });
    expect(await screen.findByRole("dialog", { name: "Langue" })).toBeTruthy();
    expect(opener.getAttribute("aria-label")).toBe("Langue : Français");
    expect(session.store.getState().game).toBe(before);
    expect(localStorage.getItem("fauna.language.v1")).toBe("fr");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
    fireEvent.click(opener);
    expect(await screen.findByRole("dialog", { name: "Langue" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(localStorage.getItem("fauna.language.v1")).toBe("fr");
  } finally {
    view.unmount();
    await session.dispose();
    rects.mockRestore();
    mediaPlay.mockRestore();
    mediaPause.mockRestore();
    mediaLoad.mockRestore();
    vi.unstubAllGlobals();
    localStorage.removeItem("fauna.language.v1");
  }
});

it("extracts authored names by stable content identity and rejects ambiguous changes", () => {
  const creature = {
    location: "src/game/content/creatures/ember.ts",
    source: `const kit = { species: { id: "ember", name: "Ember", title: "The dancer", trait: "Spark" }, cards: [attack("ember-lash", "Lash", 6)] };`,
  };
  const boon = {
    location: "src/game/content/boons.ts",
    source: `const list = [boon({ id: "old-lamp", name: "Old Lamp" })];`,
  };
  const talent = {
    location: "src/game/content/talents/burn.ts",
    source: `const list = [talent("burn.spark", "Spark", 0)];`,
  };
  const food = {
    location: "src/game/content/food.ts",
    source: `const food = [{ id: "food-apple", name: "Apple" }];`,
  };
  expect(extractContent([creature, boon, talent, food])).toEqual({
    "content.boon.old-lamp.name": { text: "Old Lamp" },
    "content.card.ember-lash.name": { text: "Lash" },
    "content.card.food-apple.name": { text: "Apple" },
    "content.species.ember.name": { text: "Ember" },
    "content.species.ember.title": { text: "The dancer" },
    "content.species.ember.trait": { text: "Spark" },
    "content.talent.burn.spark.name": { text: "Spark" },
  });
  expect(() =>
    extractContent([
      creature,
      { ...creature, source: creature.source.replace('name: "Ember"', 'name: "Changed"') },
    ]),
  ).toThrow("conflicting content");
});

it("rejects collisions between UI and authored content message IDs", () => {
  expect(() => mergeSources({ "same.id": { text: "First" } }, { "same.id": { text: "Second" } })).toThrow(
    "Duplicate source message ID",
  );
});

it("renders authored creature and card names by their stable IDs without changing game data", () => {
  const game = run();
  const card = game.cards.find((value) => value.definitionId === "mossguard-guard")!;
  const catalog: MessageCatalog = {
    "content.species.mossguard.name": { source: "Mossguard", text: "Gardemousse" },
    "content.species.mossguard.trait": { source: "Overgrowth", text: "Croissance" },
    "content.card.mossguard-guard.name": { source: "Boulder Brace", text: "Garde de pierre" },
  };
  const view = render(
    <MessageProvider locale="fr" catalog={catalog}>
      <TooltipProvider>
        <CreatureCard kind="mossguard" />
        <CreatureDetails kind="mossguard" />
        <ActionDetails card={card} ownerName="Gardemousse" />
      </TooltipProvider>
    </MessageProvider>,
  );
  expect(screen.getByRole("button", { name: "Gardemousse" })).toBeTruthy();
  expect(screen.getByText("Gardemousse")).toBeTruthy();
  expect(screen.getByText("Croissance")).toBeTruthy();
  expect(screen.getByText("Garde de pierre")).toBeTruthy();
  expect(card.definitionId).toBe("mossguard-guard");
  view.unmount();
});

it("extracts and renders keyword labels without changing their semantic identity", () => {
  const source = 'const terms = { burn: entry("Burn", "damage", "active", "Deals damage") };';
  expect(extractContent([{ location: "src/game/keywords.ts", source }])).toEqual({
    "content.keyword.burn.label": { text: "Burn" },
  });
  const catalog: MessageCatalog = { "content.keyword.burn.label": { source: "Burn", text: "Brûlure" } };
  const view = render(
    <MessageProvider locale="fr" catalog={catalog}>
      <Keyword id="burn" />
    </MessageProvider>,
  );
  const term = screen.getByText("Brûlure");
  expect(term.getAttribute("data-keyword")).toBe("burn");
  view.unmount();
});

it("extracts authored Boon rules exactly as the game produces them", () => {
  const rules = extractBoonRules(
    readFileSync("src/game/rules/boons.ts", "utf8"),
    readFileSync("src/game/keywords.ts", "utf8"),
  );
  for (const boon of BOONS) {
    const extracted = rules[`content.boon.${boon.id}.rule`];
    expect(extracted?.reference, boon.id).toBe(boon.text);
    expect(extracted?.text, boon.id).toBe(ruleMessage(boon.text).template);
  }
});

it("preserves keyword identity in a translated Boon rule and rejects missing semantic tags", () => {
  localStorage.removeItem("fauna.language.v1");
  const boon = BOONS.find((item) => item.id === "rook-of-mercy")!;
  const message = ruleMessage(boon.text);
  const source = { text: message.template, reference: boon.text };
  const translated = "<keyword0>Armure</keyword0> {{value0}} à l’arrivée des alliés";
  const entry = {
    source: message.template,
    sourceHash: sourceHash("fr", source, {}),
    reviewed: true,
    text: translated,
  };
  expect(validateCatalog({ boon: source }, { boon: entry }, "fr", {}, true)).toEqual([]);
  expect(
    validateCatalog({ boon: source }, { boon: { ...entry, text: "Armure {{value0}}" } }, "fr", {}, true),
  ).toContain("boon: invalid text or parameters");
  const catalog: MessageCatalog = {
    [`content.boon.${boon.id}.rule`]: entry,
    [`content.boon.${boon.id}.name`]: { source: boon.name, text: "Tour de miséricorde" },
  };
  const view = render(
    <LocalizationProvider catalogs={{ fr: catalog }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <BoonName boon={boon} />
      <BoonText boon={boon} />
    </LocalizationProvider>,
  );
  expect(screen.getByText("Tour de miséricorde")).toBeTruthy();
  expect(screen.getByText("Armure").getAttribute("data-keyword")).toBe("armor");
  expect(view.container.textContent).toContain("Armure 2 à l’arrivée des alliés");
  view.unmount();
  localStorage.removeItem("fauna.language.v1");
});

it("renders the reviewed French Boon catalog with gameplay magnitudes and keyword identity", () => {
  localStorage.removeItem("fauna.language.v1");
  const boon = BOONS.find((item) => item.id === "rook-of-mercy")!;
  const view = render(
    <LocalizationProvider catalogs={{ fr: french }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <BoonName boon={boon} />
      <BoonText boon={boon} />
    </LocalizationProvider>,
  );
  expect(screen.getByText("Tour de miséricorde")).toBeTruthy();
  expect(screen.getByText("Armure").getAttribute("data-keyword")).toBe("armor");
  expect(view.container.textContent).toContain("Les alliés qui entrent gagnent 2 en Armure");
  view.unmount();
});

it("extracts every authored Talent rule exactly as the game produces it", () => {
  const rules = extractTalentRules(
    readFileSync("src/game/rules/talents.ts", "utf8"),
    readFileSync("src/game/keywords.ts", "utf8"),
  );
  for (const talent of TALENTS) {
    const extracted = rules[`content.talent.${talent.id}.rule`];
    expect(extracted?.reference, talent.id).toBe(talent.text);
    expect(extracted?.text, talent.id).toBe(ruleMessage(talent.text).template);
  }
});

it("extracts every creature passive tier exactly as the game produces it", () => {
  const rules = extractPassiveRules(
    SPECIES.map(({ id }) => ({
      location: `src/game/content/creatures/${id}.ts`,
      source: readFileSync(`src/game/content/creatures/${id}.ts`, "utf8"),
    })),
    readFileSync("src/game/keywords.ts", "utf8"),
  );
  for (const creature of SPECIES) {
    creature.passiveTiers.forEach((tier, rank) => {
      const extracted = rules[`content.species.${creature.id}.passive.${rank}.rule`];
      expect(extracted?.reference, `${creature.id} ${rank}`).toBe(tier.description);
      expect(extracted?.text, `${creature.id} ${rank}`).toBe(ruleMessage(tier.description).template);
    });
  }
});
