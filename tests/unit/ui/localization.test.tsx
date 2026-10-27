import { CombatStatus } from "../../../src/ui/shared/combat/combat-status";
import { combatStatuses } from "../../../src/ui/shared/combat/combat-status-model";
import japanese from "../../../src/ui/shared/localization/locales/ja.json";
import { definition } from "../../../src/game/content";
import { extractCardVariants } from "../../../scripts/localization/card-variants.mjs";
import { cardRuleVariantId, statusRuleVariantId } from "../../../src/ui/shared/localization/rule-key.mjs";
import { extractStatusVariants } from "../../../scripts/localization/status-variants.mjs";
import { freshCombat } from "../../../src/game/combat/state";
import {
  readCardDescriptionFunctions,
  describeCardRule,
  readAuthoredCards,
  describeCompleteCard,
  enemyCardModel,
} from "../../../scripts/localization/card-model.mjs";
import { CARDS } from "../../../src/game/content";
import { PEARL } from "../../../src/game/content/creatures/memento";
import { abilityRule } from "../../../src/game/rules/abilities";
import { supplementalRule } from "../../../src/game/rules/supplemental";
import { KEYWORD_DEFINITIONS, keywordLabel } from "../../../src/game/keywords";
import { extractFoodRules } from "../../../scripts/localization/food-rules.mjs";
import { FOOD_CARDS } from "../../../src/game/content/food";
import { cardText, enemyCard } from "../../../src/game/card-rules";
import { CardRules } from "../../../src/ui/shared/combat/combat-values";
import { ActionCard } from "../../../src/ui/shared/cards/cards";
import { RuleCatalogProvider } from "../../../src/ui/shared/localization/rule-catalog";
import { TargetPreview } from "../../../src/ui/battle/target-preview";
import type { TargetForecast } from "../../../src/ui/battle/play-preview-model";
import { playPreviewModel } from "../../../src/ui/battle/play-preview-model";
import { GlossaryScreen } from "../../../src/ui/menu/glossary-screen";
import { extractGlossaryRules } from "../../../scripts/localization/glossary-rules.mjs";
import { GLOSSARY } from "../../../src/game/glossary";
import { MessageParts } from "../../../src/ui/shared/localization/message-parts";
import {
  fontHasGlyph,
  qualifiedFontIssues,
  verifiedFontSource,
} from "../../../scripts/localization/font-coverage.mjs";
import { PageControls } from "../../../src/ui/shared/navigation/pagination";
import { BattleReadout } from "../../../src/ui/shared/combat/battle-readout";
import { DamageValue } from "../../../src/ui/shared/combat/combat-values";
// @vitest-environment jsdom
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
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

it("keeps preview language choices isolated from saved preferences", () => {
  localStorage.setItem("fauna.language.v1", "ja");
  const view = render(
    <LocalizationProvider
      persist={false}
      catalogs={{ fr: french }}
      qualified={["en", "fr"]}
      systemLanguages={["en"]}
    >
      <LanguageProbe />
    </LocalizationProvider>,
  );
  expect(screen.getByLabelText("locale").textContent).toBe("en");
  fireEvent.click(screen.getByRole("button", { name: "French" }));
  expect(screen.getByLabelText("locale").textContent).toBe("fr");
  expect(localStorage.getItem("fauna.language.v1")).toBe("ja");
  view.unmount();
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
  let adapter:
    { language(): Promise<string | null>; list(): Promise<string[]>; dispose(): Promise<void> } | undefined;
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

it("localizes shared pagination and combat announcements while preserving values", () => {
  const view = render(
    <MessageProvider locale="fr" catalog={french}>
      <PageControls page={1} pages={3} change={() => {}} />
      <BattleReadout health={7} maxHealth={10} block={4} previousBlock={2} knockout />
      <DamageValue type="burn" amount={3} />
    </MessageProvider>,
  );
  expect(screen.getByRole("button", { name: "Page précédente" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Page suivante" })).toBeTruthy();
  expect(screen.getByLabelText("Blocage de 2 à 4")).toBeTruthy();
  expect(screen.getByLabelText("3 dégâts de Brûlure")).toBeTruthy();
  expect(view.container.textContent).toContain("2 → 4");
  view.unmount();
});

it("blocks script qualification when bundled fonts are missing or cannot render the language", () => {
  const languages = { ja: { name: "日本語", qualified: true }, ru: { name: "Русский", qualified: false } };
  expect(qualifiedFontIssues(languages, {}, () => null)).toEqual([
    "ja: missing bundled font noto-sans-jp.ttf",
  ]);
  expect(qualifiedFontIssues(languages, {}, () => Buffer.alloc(0))[0]).toContain(
    "ja: noto-sans-jp.ttf missing glyphs",
  );
  expect(fontHasGlyph(Buffer.alloc(0), 0x65e5)).toBe(false);
  expect(
    verifiedFontSource(
      Buffer.from("test"),
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    ),
  ).toBe(true);
  expect(
    verifiedFontSource(
      Buffer.from("changed"),
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    ),
  ).toBe(false);
  const font = Buffer.alloc(68);
  font.writeUInt16BE(1, 4);
  font.write("cmap", 12);
  font.writeUInt32BE(28, 20);
  font.writeUInt16BE(1, 30);
  font.writeUInt32BE(12, 36);
  font.writeUInt16BE(12, 40);
  font.writeUInt32BE(1, 52);
  font.writeUInt32BE(0x65e5, 56);
  font.writeUInt32BE(0x65e5, 60);
  font.writeUInt32BE(1, 64);
  expect(fontHasGlyph(font, 0x65e5)).toBe(true);
  expect(fontHasGlyph(font, 0x672c)).toBe(false);
  expect(
    qualifiedFontIssues({ ...languages, ja: { ...languages.ja, qualified: false } }, {}, () => null),
  ).toEqual([]);
});

it("reorders rich message values without replacing interactive content and rejects stale translations", () => {
  const catalog: MessageCatalog = { total: { source: "{{amount}} Gold earned", text: "獲得：{{amount}}" } };
  function Total() {
    const i18n = useMessages();
    return (
      <p>
        <MessageParts
          template={i18n.template("total", "{{amount}} Gold earned")}
          values={{ amount: <button>42</button> }}
        />
      </p>
    );
  }
  const view = render(
    <MessageProvider locale="en" catalog={{}}>
      <Total />
    </MessageProvider>,
  );
  const button = screen.getByRole("button", { name: "42" });
  button.focus();
  view.rerender(
    <MessageProvider locale="ja" catalog={catalog}>
      <Total />
    </MessageProvider>,
  );
  expect(view.container.textContent).toBe("獲得：42");
  expect(screen.getByRole("button", { name: "42" })).toBe(button);
  expect(document.activeElement).toBe(button);
  view.rerender(
    <MessageProvider locale="ja" catalog={{ total: { source: "Old {{amount}}", text: "古い {{amount}}" } }}>
      <Total />
    </MessageProvider>,
  );
  expect(view.container.textContent).toBe("42 Gold earned");
  view.unmount();
});

it("extracts glossary terms and definitions from the actual game vocabulary", () => {
  const rules = extractGlossaryRules(
    readFileSync("src/game/glossary.ts", "utf8"),
    readFileSync("src/game/keywords.ts", "utf8"),
    readFileSync("src/game/resurrection-rules.ts", "utf8"),
  );
  expect(() =>
    extractGlossaryRules(
      readFileSync("src/game/glossary.ts", "utf8").replace('"health", "block", "mana"', '"health", "block"'),
      readFileSync("src/game/keywords.ts", "utf8"),
      readFileSync("src/game/resurrection-rules.ts", "utf8"),
    ),
  ).toThrow("Unsupported glossary keyword list");
  expect(Object.keys(rules)).toHaveLength(
    GLOSSARY.length + GLOSSARY.filter((entry) => !entry.id.startsWith("keyword.")).length,
  );
  expect(new Set(GLOSSARY.map((entry) => entry.id)).size).toBe(GLOSSARY.length);
  for (const entry of GLOSSARY) {
    for (const kind of ["term", "definition"] as const) {
      if (kind === "term" && entry.id.startsWith("keyword.")) continue;
      const rule = rules[`content.glossary.${entry.id}.${kind}.rule`];
      expect(rule?.reference, `${entry.id} ${kind}`).toBe(entry[kind]);
      expect(rule?.text, `${entry.id} ${kind}`).toBe(ruleMessage(entry[kind]).template);
    }
  }
});

it("renders localized glossary rules with keyword identity and leaves authored vocabulary unchanged", () => {
  localStorage.removeItem("fauna.language.v1");
  const entry = GLOSSARY.find((item) => item.id === "keyword.burn")!;
  const catalog: MessageCatalog = {
    "content.keyword.burn.label": { source: "Burn", text: "Brûlure" },
    "content.glossary.keyword.burn.definition.rule": {
      source: ruleMessage(entry.definition).template,
      text: "Inflige des dégâts à chaque tour, puis réduit les cumuls de moitié",
    },
  };
  const view = render(
    <LocalizationProvider catalogs={{ fr: catalog }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <GlossaryScreen back={() => {}} />
    </LocalizationProvider>,
  );
  expect(screen.getByText("Brûlure").getAttribute("data-keyword")).toBe("burn");
  expect(screen.getByText("Inflige des dégâts à chaque tour, puis réduit les cumuls de moitié")).toBeTruthy();
  expect(entry.term).toBe("Burn");
  view.unmount();
});

it("localizes exact battle previews without changing their committed values", () => {
  const forecast = Object.freeze({
    name: "Rival",
    previousHealth: 6,
    health: 0,
    previousBlock: 2,
    block: 0,
    maxHealth: 6,
    absorbed: 2,
    changes: [],
    events: [],
  });
  const view = render(
    <MessageProvider locale="fr" catalog={french}>
      <TargetPreview forecast={forecast} />
    </MessageProvider>,
  );
  expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
    "Aperçu pour Rival : Santé de 6 à 0, Blocage de 2 à 0, 2 dégâts absorbés, K.-O.",
  );
  expect(screen.getByText("2 absorbés")).toBeTruthy();
  expect(forecast.health).toBe(0);
  view.unmount();
});

it("localizes conditional preview outcomes without changing their alternatives", () => {
  const base: TargetForecast = {
    name: "Rival",
    previousHealth: 6,
    health: 6,
    previousBlock: 2,
    block: 2,
    maxHealth: 6,
    absorbed: 0,
    changes: [],
    events: [],
  };
  const damaged: TargetForecast = {
    ...base,
    health: 3,
    block: 0,
    absorbed: 2,
    events: [{ kind: "damage", targetId: "rival", amount: 3, damageType: "burn", critical: true, text: "" }],
  };
  const forecast: TargetForecast = { ...base, alternatives: [damaged, base] };
  const view = render(
    <MessageProvider locale="fr" catalog={french}>
      <TargetPreview forecast={forecast} />
    </MessageProvider>,
  );
  const label = screen.getByRole("status").getAttribute("aria-label");
  expect(label).toContain("Critique : 3 de Brûlure; 2 absorbés; Blocage 2 → 0");
  expect(label).toContain("Aucun changement");
  expect(forecast.alternatives).toEqual([damaged, base]);
  view.unmount();
});

it("keeps translated conditional outcome keywords attached to their effects", () => {
  const base: TargetForecast = {
    name: "Rival",
    previousHealth: 6,
    health: 6,
    previousBlock: 0,
    block: 0,
    maxHealth: 6,
    absorbed: 0,
    changes: [],
    events: [],
  };
  const damaged: TargetForecast = {
    ...base,
    health: 3,
    events: [{ kind: "damage", targetId: "rival", amount: 3, damageType: "burn", text: "" }],
  };
  const view = render(
    <MessageProvider locale="fr" catalog={french}>
      <TargetPreview forecast={{ ...base, alternatives: [damaged, base] }} />
    </MessageProvider>,
  );
  expect(screen.getByRole("status").getAttribute("aria-label")).toContain("3 de Brûlure");
  const keyword = view.container.querySelector('.conditional-preview [data-keyword="burn"]');
  expect(keyword?.textContent).toBe("Brûlure");
  expect(keyword?.getAttribute("data-effect-keywords")).toBe("burn");
  const critical: TargetForecast = {
    ...damaged,
    events: [{ kind: "damage", targetId: "rival", amount: 3, damageType: "burn", critical: true, text: "" }],
  };
  const catalog: MessageCatalog = {
    ...french,
    "preview.outcomeCritical": { source: "Critical {{description}}", text: "Crit {{description}}" },
  };
  view.rerender(
    <MessageProvider locale="fr" catalog={catalog}>
      <TargetPreview forecast={{ ...base, alternatives: [critical, base] }} />
    </MessageProvider>,
  );
  expect(view.container.querySelector('.conditional-preview [data-keyword="criticalHit"]')?.textContent).toBe(
    "Crit ",
  );
  expect(view.container.querySelector('.conditional-preview [data-keyword="burn"]')?.textContent).toBe(
    "Brûlure",
  );
  view.unmount();
});

it("localizes projected status changes and retains their keyword identity", () => {
  localStorage.removeItem("fauna.language.v1");
  const game = run();
  const changed = produce(game, (draft) => {
    Object.assign(draft.team[0]!.combat!, { burn: 2, controlled: "freeze", controlTurns: 2 });
  });
  const forecast = playPreviewModel(game, { accepted: true, state: changed, events: [] }).units.get(
    game.team[0]!.id,
  );
  const view = render(
    <LocalizationProvider catalogs={{ fr: french }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <TargetPreview forecast={forecast} />
    </LocalizationProvider>,
  );
  const label = screen.getByRole("status").getAttribute("aria-label");
  expect(label).toContain("Brûlure 0 → 2");
  expect(label).toContain("Gel : 2 tours");
  expect(view.container.querySelector('[data-keyword="burn"]')?.textContent).toBe("Brûlure");
  expect(view.container.querySelector('[data-keyword="freeze"]')?.textContent).toBe("Gel");
  expect(game.team[0]!.combat!.burn).toBe(0);
  view.unmount();
});

it("bundles fonts covering each script language's native selector label", () => {
  for (const [file, label] of [
    ["noto-sans-jp.ttf", "日本語"],
    ["noto-sans-sc.ttf", "简体中文"],
    ["noto-sans.ttf", "Русский"],
  ] as const) {
    const font = readFileSync(`src/assets/fonts/${file}`);
    for (const character of label)
      expect(fontHasGlyph(font, character.codePointAt(0)!), `${file}: ${character}`).toBe(true);
  }
});

it("localizes action-card announcements with the same translated rule used for presentation", () => {
  const game = run();
  const card = game.cards.find((item) => item.definitionId === "mossguard-guard")!;
  const rule = ruleMessage("Gain 6 Block");
  const catalog: MessageCatalog = {
    "content.card.mossguard-guard.name": { source: "Boulder Brace", text: "Garde de pierre" },
    "card.actionLabel": {
      source: "{{name}}, {{owner}}, {{mana}} mana, {{effect}}",
      text: "{{effect}} · {{name}} · {{owner}} · {{mana}} Mana",
    },
  };
  const view = render(
    <MessageProvider locale="fr" catalog={catalog}>
      <RuleCatalogProvider
        catalog={{
          [cardRuleVariantId(card.definitionId, rule.template)]: {
            source: rule.template,
            text: "Gagnez {{value0}} <keyword0>Blocage</keyword0>",
          },
        }}
      >
        <TooltipProvider>
          <ActionCard card={card} ownerName="Gardemousse" onClick={() => {}} />
        </TooltipProvider>
      </RuleCatalogProvider>
    </MessageProvider>,
  );
  expect(
    screen.getByRole("button", { name: "Gagnez 6 Blocage · Garde de pierre · Gardemousse · 1 Mana" }),
  ).toBeTruthy();
  expect(card.definitionId).toBe("mossguard-guard");
  view.unmount();
});

it("extracts Food rules for individual and team targets from the production descriptions", () => {
  const rules = extractFoodRules(
    readFileSync("src/game/content/food.ts", "utf8"),
    readFileSync("src/game/card-rules.ts", "utf8"),
    readFileSync("src/game/rules/abilities.ts", "utf8"),
    readFileSync("src/game/keywords.ts", "utf8"),
  );
  for (const card of FOOD_CARDS) {
    for (const all of card.effect === "heal" || card.effect === "guard" ? [false, true] : [false]) {
      const text = cardText(card, 0, undefined, 1, all ? { boons: ["pumpkin-tureen"] } : undefined);
      const rule = rules[`content.card.${card.id}.${all ? "all." : ""}rule`];
      expect(rule?.reference, `${card.id} ${all}`).toBe(text);
      expect(rule?.text, `${card.id} ${all}`).toBe(ruleMessage(text).template);
    }
  }
  expect(Object.keys(rules)).toHaveLength(5);
});

it("uses the same localized Food rule in tooltips and accessible card names", () => {
  localStorage.removeItem("fauna.language.v1");
  const apple = FOOD_CARDS.find((entry) => entry.id === "food-apple")!;
  const card = { id: "food-test", definitionId: "food-apple" as const, ownerId: null, level: 0 };
  const view = render(
    <LocalizationProvider catalogs={{ fr: french }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <TooltipProvider>
        <ActionCard card={card} ownerName="Nourriture" onClick={() => {}} />
        <CardRules card={apple} value={12} />
      </TooltipProvider>
    </LocalizationProvider>,
  );
  expect(
    screen.getByRole("button", { name: "Pomme, Nourriture, 1 Mana, Restaure 6 Santé ; Consommer" }),
  ).toBeTruthy();
  expect(screen.getByText("Santé").getAttribute("data-keyword")).toBe("health");
  expect(view.container.textContent).toContain("Restaure 12 Santé ; Consommer");
  const teamBuff = produce(run(), (draft) => {
    draft.boons.push("pumpkin-tureen");
  });
  view.rerender(
    <LocalizationProvider catalogs={{ fr: french }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <TooltipProvider>
        <ActionCard card={card} ownerName="Nourriture" modifiers={teamBuff} onClick={() => {}} />
        <CardRules card={apple} value={12} modifiers={teamBuff} />
      </TooltipProvider>
    </LocalizationProvider>,
  );
  expect(
    screen.getByRole("button", {
      name: "Pomme, Nourriture, 1 Mana, Restaure 6 Santé à tous les alliés ; Consommer",
    }),
  ).toBeTruthy();
  expect(view.container.textContent).toContain("Restaure 12 Santé à tous les alliés ; Consommer");
  view.unmount();
});

it("reads authored card description functions without executing source", () => {
  const abilities = readCardDescriptionFunctions(readFileSync("src/game/rules/abilities.ts", "utf8"));
  const extras = readCardDescriptionFunctions(readFileSync("src/game/rules/supplemental.ts", "utf8"));
  const labels = Object.fromEntries(
    Object.entries(KEYWORD_DEFINITIONS).map(([id, entry]) => [id, entry.label]),
  );
  for (const card of [...CARDS, PEARL]) {
    for (const value of [1, 2]) {
      for (const power of [1, 1.7]) {
        const context = { value, level: 0, power, label: keywordLabel };
        expect(describeCardRule(abilities[card.effect], [card, context], labels), card.id).toBe(
          abilityRule(card.effect).describe(card, context),
        );
      }
    }
    for (const effect of card.effects ?? [])
      expect(describeCardRule(extras[effect.kind], [effect, card, keywordLabel], labels), card.id).toBe(
        supplementalRule(effect.kind).describe(effect, card, keywordLabel),
      );
  }
});

it("reads literal authored cards by identity and rejects unknown builder expressions", () => {
  const directory = "src/game/content/creatures";
  const files = readdirSync(directory)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => ({
      location: `${directory}/${file}`,
      source: readFileSync(`${directory}/${file}`, "utf8"),
    }));
  const authored = readAuthoredCards(files);
  expect(Object.keys(authored).sort()).toEqual([...CARDS, PEARL].map((card) => card.id).sort());
  for (const card of [...CARDS, PEARL])
    for (const [key, value] of Object.entries(authored[card.id]!))
      expect(card, card.id).toHaveProperty(key, value);
  expect(() =>
    readAuthoredCards([
      { location: "creature.ts", source: 'const x = attack("x-a", "A", readValue(), "burn")' },
    ]),
  ).toThrow("Unsupported card literal");
});

it("reads complete authored card rules with changing values and room power", () => {
  const sources = {
    cardRules: readFileSync("src/game/card-rules.ts", "utf8"),
    abilities: readFileSync("src/game/rules/abilities.ts", "utf8"),
    supplemental: readFileSync("src/game/rules/supplemental.ts", "utf8"),
  };
  const labels = Object.fromEntries(
    Object.entries(KEYWORD_DEFINITIONS).map(([id, entry]) => [id, entry.label]),
  );
  for (const card of [...CARDS, PEARL])
    for (const value of [1, 2])
      for (const power of [1, 1.7])
        for (const level of [0, 1])
          expect(
            describeCompleteCard(card, level, value, power, sources, labels),
            `${card.id} ${value} ${power} ${level}`,
          ).toBe(cardText(card, level, value, power));
});

it("models enemy card adaptation without changing authored cards", () => {
  const directory = "src/game/content/creatures";
  const files = readdirSync(directory)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => ({
      location: `${directory}/${file}`,
      source: readFileSync(`${directory}/${file}`, "utf8"),
    }));
  const cards = readAuthoredCards(files),
    abilities = readFileSync("src/game/rules/abilities.ts", "utf8"),
    supplemental = readFileSync("src/game/rules/supplemental.ts", "utf8");
  for (const card of [...CARDS, PEARL]) {
    const expected = enemyCard(card);
    const actual = enemyCardModel(cards[card.id]!, abilities, supplemental);
    for (const [key, value] of Object.entries(actual)) expect(expected, card.id).toHaveProperty(key, value);
  }
});

it("extracts each authored player and enemy rule variant using production text", () => {
  const directory = "src/game/content/creatures";
  const files = readdirSync(directory)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => ({
      location: `${directory}/${file}`,
      source: readFileSync(`${directory}/${file}`, "utf8"),
    }));
  const sources = {
    cardRules: readFileSync("src/game/card-rules.ts", "utf8"),
    abilities: readFileSync("src/game/rules/abilities.ts", "utf8"),
    supplemental: readFileSync("src/game/rules/supplemental.ts", "utf8"),
    contracts: readFileSync("src/game/rules/contracts.ts", "utf8"),
    abilityValues: readFileSync("src/game/combat/ability-values.ts", "utf8"),
  };
  const keywordSource = readFileSync("src/game/keywords.ts", "utf8");
  const rules = extractCardVariants(files, sources, keywordSource);
  const missing: string[] = [];
  for (const card of [...CARDS, PEARL])
    for (const model of [card, enemyCard(card)])
      for (const value of [card.value, 1, 2])
        for (const power of [1, 1.7])
          for (const level of [0, 1]) {
            const template = ruleMessage(cardText(model, level, value, power)).template;
            if (rules[cardRuleVariantId(card.id, template)]?.text !== template)
              missing.push(`${card.id} ${value} ${power} ${level}: ${template}`);
          }
  expect(missing).toEqual([]);
  expect(() =>
    extractCardVariants(
      files,
      {
        ...sources,
        contracts: sources.contracts.replace("Math.round(amount * power)", "Math.floor(amount * power)"),
      },
      keywordSource,
    ),
  ).toThrow("Unsupported card power scaling");
});

it("uses the reviewed card rule for both artwork announcements and tooltip values", () => {
  localStorage.removeItem("fauna.language.v1");
  const game = run();
  const card = game.cards.find((item) => item.definitionId === "mossguard-guard")!;
  const view = render(
    <LocalizationProvider catalogs={{ fr: french }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <TooltipProvider>
        <ActionCard card={card} ownerName="Mossguard" onClick={() => {}} />
        <CardRules card={definition(card.definitionId)} value={12} />
      </TooltipProvider>
    </LocalizationProvider>,
  );
  expect(
    screen.getByRole("button", { name: "Boulder Brace, Mossguard, 1 Mana, Gagne 6 Blocage" }),
  ).toBeTruthy();
  expect(view.container.textContent).toContain("Gagne 12 Blocage");
  expect(screen.getByText("Blocage").getAttribute("data-keyword")).toBe("block");
  view.unmount();
});

it("renders localized keyword labels and card rules with their shared gameplay identity", () => {
  localStorage.removeItem("fauna.language.v1");
  const view = render(
    <LocalizationProvider catalogs={{ ja: japanese }} qualified={["en", "ja"]} systemLanguages={["ja"]}>
      <Keyword id="stun" />
      <CardRules card={definition("mossguard-attack")} value={4} />
    </LocalizationProvider>,
  );
  const labels = screen.getAllByText("スタン");
  expect(labels).toHaveLength(2);
  expect(labels.every((label) => label.getAttribute("data-keyword") === "stun")).toBe(true);
  expect(view.container.textContent).toContain("すべての敵にスタンダメージを4与える");
  view.unmount();
});

it("preserves English combat status snapshots and localizes their rules without changing identity", () => {
  const game = produce(run(), (draft) => {
    Object.assign(draft.team[0]!.combat!, {
      armor: 3,
      thorns: 2,
      dodge: 10,
      temporaryDodge: 4,
      burn: 1,
      poison: 2,
      bleed: 2,
      stun: 1,
      freeze: 1,
    });
  });
  const combat = game.team[0]!.combat!;
  const expected = combatStatuses(combat, 5).map((status) => status.text);
  const view = render(
    <TooltipProvider>
      <CombatStatus combat={combat} sharedDodge={5} details />
    </TooltipProvider>,
  );
  expect(
    [...view.container.querySelectorAll(".combat-status-details p")].map((item) => item.textContent),
  ).toEqual(expected);
  const burn = KEYWORD_DEFINITIONS.burn.description;
  const catalog: MessageCatalog = {
    "content.keyword.burn.label": { source: "Burn", text: "Brûlure" },
    "content.glossary.keyword.burn.definition.rule": {
      source: ruleMessage(burn).template,
      text: "Inflige des dégâts à chaque tour, puis réduit les cumuls de moitié",
    },
    "status.measured": {
      source: "{{keyword}} {{count}}; {{description}}",
      text: "{{keyword}} {{count}} : {{description}}",
    },
  };
  view.rerender(
    <LocalizationProvider catalogs={{ fr: catalog }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <TooltipProvider>
        <CombatStatus combat={combat} sharedDodge={5} details />
      </TooltipProvider>
    </LocalizationProvider>,
  );
  const keyword = screen.getByText("Brûlure");
  expect(keyword.getAttribute("data-keyword")).toBe("burn");
  expect(keyword.closest("p")?.textContent).toBe(
    "Brûlure 1 : Inflige des dégâts à chaque tour, puis réduit les cumuls de moitié",
  );
  view.unmount();
  const onlyBurn = {
    ...combat,
    armor: 0,
    thorns: 0,
    dodge: 0,
    temporaryDodge: 0,
    poison: 0,
    bleed: 0,
    stun: 0,
    freeze: 0,
  };
  const tile = render(
    <LocalizationProvider catalogs={{ fr: catalog }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <TooltipProvider>
        <CombatStatus combat={onlyBurn} />
      </TooltipProvider>
    </LocalizationProvider>,
  );
  expect(
    screen.getByRole("button", {
      name: "Brûlure 1 : Inflige des dégâts à chaque tour, puis réduit les cumuls de moitié",
    }),
  ).toBeTruthy();
  tile.unmount();
});

it("keeps visual and accessible status counts consistent when the message falls back", () => {
  localStorage.removeItem("fauna.language.v1");
  const game = produce(run(), (draft) => {
    draft.team[0]!.combat!.burn = 1000;
  });
  const combat = game.team[0]!.combat!;
  const catalog: MessageCatalog = { "content.keyword.burn.label": { source: "Burn", text: "Brand" } };
  const view = render(
    <LocalizationProvider catalogs={{ de: catalog }} qualified={["en", "de"]} systemLanguages={["de"]}>
      <TooltipProvider>
        <CombatStatus combat={combat} />
        <CombatStatus combat={combat} details />
      </TooltipProvider>
    </LocalizationProvider>,
  );
  const label = screen.getByRole("button").getAttribute("aria-label");
  const text = view.container.querySelector(".combat-status-details p")?.textContent;
  expect(label).toContain("Brand 1.000");
  expect(label).toBe(text);
  view.unmount();
});

it("announces a reviewed status and glossary definition in the selected language", () => {
  localStorage.removeItem("fauna.language.v1");
  const game = produce(run(), (draft) => {
    draft.team[0]!.combat!.burn = 1;
  });
  const view = render(
    <LocalizationProvider catalogs={{ fr: french }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <TooltipProvider>
        <CombatStatus combat={game.team[0]!.combat} />
      </TooltipProvider>
    </LocalizationProvider>,
  );
  expect(
    screen.getByRole("button", {
      name: "Brûlure 1 ; Inflige des dégâts à chaque tour, puis réduit les cumuls de moitié",
    }),
  ).toBeTruthy();
  view.unmount();
});

it("extracts and presents transient combat status variants without changing their rules", () => {
  const sources = [
    "src/ui/shared/combat/combat-status-model.ts",
    "src/game/glossary.ts",
    "src/game/keywords.ts",
    "src/game/resurrection-rules.ts",
  ].map((file) => readFileSync(file, "utf8")) as [string, string, string, string];
  const variants = extractStatusVariants(...sources);
  const seen = new Set<string>();
  const combat = {
    ...freshCombat(),
    cooldown: 2,
    grace: 2,
    rhythm: 10,
    nextPhysical: 2,
    partingCut: true,
    riposte: true,
    freeNature: true,
    freeLight: true,
    freeCard: true,
    blind: true,
    nullifyFreeze: true,
    attackReflection: true,
    negate: true,
    nullify: true,
    reflectBurn: true,
    reflect: true,
  };
  for (const controlled of [null, "freeze", "stun"] as const) {
    for (const controlTurns of [0, 1, 2]) {
      for (const status of combatStatuses({ ...combat, controlled, controlTurns, skipped: true })) {
        const template = ruleMessage(status.text).template;
        const id = statusRuleVariantId(status.id, template);
        expect(variants[id]?.text).toBe(template);
        seen.add(id);
      }
    }
  }
  expect([...seen].sort()).toEqual(Object.keys(variants).sort());
  expect(() =>
    extractStatusVariants(
      sources[0].replace("combat.rhythm}%", "combat.unknownStatus}%"),
      sources[1],
      sources[2],
      sources[3],
    ),
  ).toThrow("Unsupported status value");

  const frozen = { ...freshCombat(), controlled: "freeze" as const, controlTurns: 2 };
  const source = ruleMessage(combatStatuses(frozen)[0]!.text).template;
  const id = statusRuleVariantId("controlled", source);
  expect(french[id as keyof typeof french]).toMatchObject({ source });
  localStorage.removeItem("fauna.language.v1");
  const view = render(
    <LocalizationProvider catalogs={{ fr: french }} qualified={["en", "fr"]} systemLanguages={["fr"]}>
      <TooltipProvider>
        <CombatStatus combat={frozen} />
        <CombatStatus combat={frozen} details />
      </TooltipProvider>
    </LocalizationProvider>,
  );
  expect(screen.getByRole("button", { name: "Gel : 2 tours" })).toBeTruthy();
  expect(view.container.querySelector('.combat-status-details [data-keyword="freeze"]')?.textContent).toBe(
    "Gel",
  );
  expect(frozen.controlTurns).toBe(2);
  view.unmount();
});
