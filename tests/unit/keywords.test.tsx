import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CARDS, DAMAGE_LABELS } from "../../src/game/content";
import { GLOSSARY } from "../../src/game/glossary";
import {
  DAMAGE_TYPES,
  KEYWORD_DEFINITIONS,
  KEYWORD_IDS,
  PROGRESSION_KEYWORDS,
  definitionKeywords,
  isKeywordId,
  keywordText,
} from "../../src/game/keywords";
import { cardKeywords, KEYWORDS, TALENTS } from "../../src/game/progression";
import { decodeSave, encodeSave } from "../../src/game/save";
import { appendFeedback, CombatFeedback } from "../../src/ui/combat-feedback";
import { BattleReadout } from "../../src/ui/target-preview";
import { CardRules } from "../../src/ui/combat-values";
import { KeywordText } from "../../src/ui/keyword-text";
import { run } from "./helpers";

describe("keyword foundation", () => {
  it("classifies authored effects without reading names or rules text, using only current talent categories", () => {
    const expected = [
      "nature",
      "block",
      "block",
      "fire",
      "heal",
      "block",
      "lightning",
      "block",
      "block",
      "light",
      "heal",
      "block",
      "physical",
      "block",
      "block",
      "light",
      "heal",
      "block",
    ];
    expect(CARDS.map((card) => cardKeywords({ definitionId: card.id }))).toEqual(expected.map((id) => [id]));
    expect(definitionKeywords({ effect: "attack", damageType: "poison" })).toEqual(["poison"]);
    expect(KEYWORDS).toEqual([
      "physical",
      "fire",
      "ice",
      "lightning",
      "poison",
      "nature",
      "light",
      "block",
      "heal",
    ]);
    expect(TALENTS).toHaveLength(54);
    expect(isKeywordId("mark")).toBe(false);
    expect(CARDS.every((card) => String(card.effect) !== "mark")).toBe(true);
    const state = run();
    const obsolete = { ...state, version: 9 };
    expect(() => decodeSave(JSON.stringify(obsolete))).toThrow();
    const removedXP = { ...state, keywordXP: { mark: 20 } };
    expect(() => decodeSave(JSON.stringify(removedXP))).toThrow();
    expect(decodeSave(encodeSave(state))).toEqual(state);
    for (const id of KEYWORD_IDS.filter((id) => KEYWORD_DEFINITIONS[id].availability === "planned")) {
      expect(PROGRESSION_KEYWORDS).not.toContain(id);
      const save = JSON.parse(encodeSave(state));
      save.keywordXP[id] = 20;
      expect(() => decodeSave(JSON.stringify(save))).toThrow();
      expect(GLOSSARY.some((entry) => entry.term === KEYWORD_DEFINITIONS[id].label)).toBe(false);
    }
  });

  it("matches whole words and aliases, preserving text, casing and punctuation without enabling planned rules", () => {
    const text = "Marked: 2 MARKS. Restore Health; Healing. Firefly, blockaded, Consume marks, Burn.";
    const parts = keywordText(text);
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.keyword).map((part) => [part.text, part.keyword])).toEqual([
      ["Health", "health"],
      ["Healing", "heal"],
    ]);
    expect(
      keywordText("Holy and Gold")
        .filter((part) => part.keyword)
        .map((part) => part.keyword),
    ).toEqual(["light", "currency"]);
    expect(keywordText(text)).toEqual(parts);
    expect(keywordText("")).toEqual([]);
    expect(isKeywordId("constructor")).toBe(false);
    expect(isKeywordId("__proto__")).toBe(false);
    expect(isKeywordId("burn")).toBe(true);
    expect(Object.isFrozen(KEYWORD_DEFINITIONS.heal.aliases)).toBe(true);
  });

  it("renders the same keyword identity on card rules and prose without changing accessible text", () => {
    const attack = CARDS.find((card) => card.id === "emberfox-attack")!;
    const html = renderToStaticMarkup(<CardRules card={attack} value={13} />);
    expect(html).toContain('data-keyword="fire">Fire</span>');
    expect(html.replace(/<[^>]+>/g, "")).toBe("Deal 13 Fire damage.");
    expect(html).not.toContain('data-keyword="consume"');
    const unsafe = renderToStaticMarkup(<KeywordText text={"<script>Fire</script>"} />);
    expect(unsafe).toContain("&lt;script&gt;");
    expect(unsafe).not.toContain("<script>");
    const bursts = appendFeedback(
      [],
      [
        { kind: "heal", targetId: "ally-0", amount: 2, text: "" },
        { kind: "block", targetId: "ally-0", amount: 1, text: "" },
      ],
      1,
      0,
    );
    const feedback = renderToStaticMarkup(<CombatFeedback bursts={bursts} targetId="ally-0" />);
    expect(feedback).toContain('data-combat-tone="heal"');
    expect(feedback).toContain('data-combat-tone="block"');
    const readout = renderToStaticMarkup(<BattleReadout health={10} maxHealth={20} block={2} />);
    expect(readout).toContain('data-combat-tone="block"');
  });

  it("assigns every keyword a readable design token and shared selector, retaining damage labels", () => {
    const tokens = readFileSync(new URL("../../src/ui/tokens.css", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../../src/ui/styles.css", import.meta.url), "utf8");
    const luminance = (hex: string) => {
      const [r, g, b] = [0, 2, 4].map((offset) => {
        const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
    };
    for (const id of KEYWORD_IDS) {
      const match = new RegExp(`--keyword-${id}: #([a-f0-9]{6});`).exec(tokens);
      expect(match, id).not.toBeNull();
      // Normal text remains readable on the lightest standard text surface, muted #262626.
      expect((luminance(match![1]!) + 0.05) / (luminance("262626") + 0.05), id).toBeGreaterThanOrEqual(4.5);
      expect(styles).toContain(`[data-keyword="${id}"]`);
      expect(styles).toContain(`color: var(--keyword-${id});`);
    }
    for (const id of DAMAGE_TYPES) expect(DAMAGE_LABELS[id]).toBe(KEYWORD_DEFINITIONS[id].label);
  });
});
