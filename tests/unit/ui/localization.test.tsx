// @vitest-environment jsdom
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  applyPackets,
  preparePackets,
  qualificationIssues,
  sourceHash,
  validateCatalog,
} from "../../../scripts/localization/catalog.mjs";
import { extractMessages } from "../../../scripts/localization/messages.mjs";
import { produce } from "immer";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
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
