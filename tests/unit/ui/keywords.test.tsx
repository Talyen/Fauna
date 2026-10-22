import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CARDS, TALENTS } from "../../../src/game/content";
import { DAMAGE_LABELS } from "../../../src/game/card-rules";
import { GLOSSARY } from "../../../src/game/glossary";
import {
  DAMAGE_TYPES,
  KEYWORD_DEFINITIONS,
  KEYWORD_IDS,
  PROGRESSION_KEYWORDS,
  definitionKeywords,
  isKeywordId,
  keywordText,
} from "../../../src/game/keywords";
import { cardKeywords, KEYWORDS } from "../../../src/game/progression";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { appendFeedback, CombatFeedback } from "../../../src/ui/battle/combat-feedback";
import { BattleReadout } from "../../../src/ui/shared/combat/battle-readout";
import { CardRules } from "../../../src/ui/shared/combat/combat-values";
import { KeywordText } from "../../../src/ui/shared/keyword-text";
import { run } from "../../support/game";

describe("keyword foundation", () => {
  it("classifies authored effects without reading names or rules text, using only current talent categories", () => {
    const expected = [
      ["light"],
      ["light"],
      [],
      ["mana"],
      [],
      ["dodge"],
      ["mana"],
      ["health"],
      ["health"],
      ["water"],
      ["health"],
      ["mana"],
      ["physical"],
      [],
      ["water", "mana"],
      ["burn"],
      ["block"],
      ["mana"],
      ["light"],
      ["dodge"],
      [],
      ["stun"],
      ["stun", "armor"],
      ["block", "nature"],
      ["health"],
      ["light"],
      ["health"],
      ["block"],
      ["water"],
      [],
      ["physical", "burn"],
      ["burn", "light"],
      ["burn"],
      ["nature"],
      ["block", "nature"],
      ["health"],
      ["physical"],
      ["physical"],
      ["dodge"],
      ["block"],
      ["stun"],
      ["health"],
      ["physical", "armor"],
      ["burn"],
      ["stun"],
      ["light"],
      ["block"],
      ["health"],
      ["physical"],
      ["block"],
      ["light"],
      ["poison"],
      ["block", "health"],
      [],
      ["stun"],
      [],
      ["health"],
      ["block"],
      ["health"],
      ["health"],
      ["block"],
      ["freeze", "health"],
      ["mana"],
      ["health"],
      ["mana", "block"],
      [],
    ];
    expect(CARDS.map((card) => cardKeywords({ definitionId: card.id }))).toEqual(expected);
    expect(definitionKeywords({ effect: "attack", damageType: "poison" })).toEqual(["poison"]);
    expect(KEYWORDS).toEqual([
      "physical",
      "burn",
      "freeze",
      "stun",
      "poison",
      "nature",
      "water",
      "light",
      "bleed",
      "block",
      "health",
      "armor",
      "dodge",
      "leech",
      "mana",
    ]);
    expect(definitionKeywords({ effect: "heal", effects: [{ kind: "cleanse" }] })).toEqual(["health"]);
    expect(new Set(TALENTS.map((talent) => talent.keyword))).toEqual(new Set(KEYWORDS));
    for (const id of [
      "fire",
      "ice",
      "lightning",
      "heal",
      "healing",
      "forge",
      "currency",
      "gold",
      "wish",
      "consume",
      "companion",
      "archery",
    ]) {
      expect(isKeywordId(id)).toBe(false);
      expect(KEYWORDS).not.toContain(id);
      expect(TALENTS.some((talent) => talent.id.startsWith(`${id}.`))).toBe(false);
    }
    expect(isKeywordId("mark")).toBe(false);
    expect(CARDS.every((card) => String(card.effect) !== "mark")).toBe(true);
    const state = run();
    const obsolete = { ...state, version: 22 };
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
      ["Burn", "burn"],
    ]);
    expect(
      keywordText("Holy and Gold")
        .filter((part) => part.keyword)
        .map((part) => part.keyword),
    ).toEqual(["light"]);
    expect(keywordText(text)).toEqual(parts);
    expect(keywordText("")).toEqual([]);
    expect(isKeywordId("constructor")).toBe(false);
    expect(isKeywordId("__proto__")).toBe(false);
    expect(isKeywordId("burn")).toBe(true);
    expect(Object.isFrozen(KEYWORD_DEFINITIONS.health.aliases)).toBe(true);
  });

  it("renders the same keyword identity on card rules and prose without changing accessible text", () => {
    const attack = CARDS.find((card) => card.id === "emberback-furnace-breath")!;
    const html = renderToStaticMarkup(<CardRules card={attack} value={13} />);
    expect(html).toContain('data-keyword="burn">Burn</span>');
    expect(html.replace(/<[^>]+>/g, "")).toBe("Deal 13 Burn damage to all enemies");
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
    const feedback = renderToStaticMarkup(<CombatFeedback bursts={bursts} />);
    expect(feedback).toContain('data-combat-tone="health"');
    expect(feedback).toContain('data-combat-tone="block"');
    const readout = renderToStaticMarkup(<BattleReadout health={10} maxHealth={20} block={2} />);
    expect(readout).toContain('data-combat-tone="block"');
  });

  it("uses Alchemy colors and shared selectors for canonical keyword and damage labels", () => {
    const tokens = readFileSync(new URL("../../../src/ui/tokens.css", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../../../src/ui/shared/keywords.css", import.meta.url), "utf8");
    const alchemyColors: Partial<Record<(typeof KEYWORD_IDS)[number], string>> = {
      poison: "15803d",
      nature: "059669",
      thorns: "059669",
      bleed: "dc2626",
      leech: "9f1239",
    };
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
      // The darker Alchemy identities intentionally replace Fauna's lighter contrast variants.
      if (alchemyColors[id]) expect(match![1], id).toBe(alchemyColors[id]);
      else
        expect((luminance(match![1]!) + 0.05) / (luminance("262626") + 0.05), id).toBeGreaterThanOrEqual(4.5);
      expect(styles).toContain(`[data-keyword="${id}"]`);
      expect(styles).toContain(`color: var(--keyword-${id});`);
    }
    for (const id of DAMAGE_TYPES) {
      expect(DAMAGE_LABELS[id]).toBe(KEYWORD_DEFINITIONS[id].label);
      expect(styles).toContain(`[data-damage-type="${id}"]`);
    }
  });
});
