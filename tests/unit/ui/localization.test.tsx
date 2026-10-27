// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { extractMessages } from "../../../scripts/localization/messages.mjs";
import { produce } from "immer";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { ReplacementPicker } from "../../../src/ui/shared/cards/roster-picker";
import { addBackups, run } from "../../support/game";
import { MenuActions } from "../../../src/ui/menu/menu-actions";
import { resolveLanguage, type GameLocale } from "../../../src/ui/shared/localization/languages";
import { MessageProvider } from "../../../src/ui/shared/localization/message-context";
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
