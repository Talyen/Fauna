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
import { PEARL } from "../../../src/game/content/creatures/memento";

describe("keyword foundation", () => {
  it("classifies authored effects without reading names or rules text, using only current talent categories", () => {
    for (const damageType of DAMAGE_TYPES)
      expect(definitionKeywords({ effect: "attack", damageType })).toEqual([damageType]);
    for (const [effects, expected] of [
      [["guard", "redistributeBlock"], ["block"]],
      [["heal", "procession", "teamCleanse", "teamThaw", "teamClearBlind"], ["health"]],
      [
        ["createPearls", "pearl"],
        ["mana", "block"],
      ],
      [["redraw", "swapLowest", "recover", "teamBlind", "swap", "draw", "nullify"], []],
      [["dodge"], ["dodge"]],
      [["mana"], ["mana"]],
      [["teamPurge"], ["light"]],
    ] as const)
      for (const effect of effects) expect(definitionKeywords({ effect })).toEqual(expected);
    const cases = [
      [{ effect: "attack", damageType: "poison" }, ["poison"]],
      [
        { effect: "attack", damageType: "physical", alternateDamageType: "burn", leech: true },
        ["physical", "burn", "leech"],
      ],
      [{ effect: "heal", effects: [{ kind: "cleanse" }] }, ["health"]],
      [{ effect: "guard", effects: [{ kind: "status", status: "thorns" }] }, ["block", "nature"]],
      [
        {
          effect: "draw",
          effects: [{ kind: "damage", damageType: "water", leech: true }, { kind: "meltArmor" }],
        },
        ["water", "leech", "light"],
      ],
      [{ effect: "teamProtection" }, ["block", "nature"]],
      [{ effect: "createPearls" }, ["mana", "block"]],
      [{ effect: "redraw" }, []],
      [{ effect: "guard", effects: [{ kind: "status", status: "block" }, { kind: "unknown" }] }, ["block"]],
    ] as const;
    for (const [definition, expected] of cases) expect(definitionKeywords(definition)).toEqual(expected);
    for (const card of CARDS) {
      const keywords = cardKeywords({ definitionId: card.id });
      expect(new Set(keywords).size, card.id).toBe(keywords.length);
      expect(
        keywords.every((id) => PROGRESSION_KEYWORDS.includes(id)),
        card.id,
      ).toBe(true);
      const renamed = { ...card, name: "Burn Heal", description: "Deal Water damage" };
      expect(definitionKeywords(renamed)).toEqual(keywords);
    }
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
      "companion",
      "archery",
    ]) {
      expect(isKeywordId(id)).toBe(false);
      expect(KEYWORDS).not.toContain(id);
      expect(TALENTS.some((talent) => talent.id.startsWith(`${id}.`))).toBe(false);
    }
    expect(isKeywordId("mark")).toBe(false);
    expect(isKeywordId("consume")).toBe(true);
    expect(PROGRESSION_KEYWORDS).not.toContain("consume");
    expect(TALENTS.some((talent) => talent.id.startsWith("consume."))).toBe(false);
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
      ["Healing", "health"],
      ["Consume", "consume"],
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

  it("colors keyword inflections in Boon prose without changing the wording", () => {
    const text =
      "Light hits Blind Burning enemies; Cards dodged by enemies return to hand; Allies keep their last beneficial effect when Purged; Cleansed effects return to their source; Thorns guard Armor and Block; Overflow Healing; Critical Hits";
    const html = renderToStaticMarkup(<KeywordText text={text} />);
    const colored = Array.from(
      html.matchAll(/<span\b[^>]*\bdata-keyword="([^"]+)"[^>]*>([^<]+)<\/span>/g),
      ([, id, word]) => [word, id],
    );
    expect(colored).toEqual([
      ["Light", "light"],
      ["Blind", "blind"],
      ["Burning", "burn"],
      ["dodged", "dodge"],
      ["Purged", "purge"],
      ["Cleansed", "cleanse"],
      ["Thorns", "thorns"],
      ["Armor", "armor"],
      ["Block", "block"],
      ["Healing", "health"],
      ["Critical Hits", "criticalHit"],
    ]);
    expect(html.replace(/<[^>]+>/g, "")).toBe(text);
  });

  it("renders the same keyword identity on card rules and prose without changing accessible text", () => {
    const attack = CARDS.find((card) => card.id === "emberback-furnace-breath")!;
    const html = renderToStaticMarkup(<CardRules card={attack} value={13} />);
    expect(html).toMatch(/<span\b[^>]*\bdata-keyword="burn"[^>]*>Burn<\/span>/);
    expect(html.replace(/<[^>]+>/g, "")).toBe("Deal 13 Burn damage to all enemies");
    expect(html).not.toContain('data-keyword="consume"');
    const pearl = renderToStaticMarkup(<CardRules card={PEARL} value={2} />);
    expect(pearl).toMatch(/<span\b[^>]*\bdata-keyword="consume"[^>]*>Consume<\/span>/);
    expect(pearl.replace(/<[^>]+>/g, "")).toBe("Consume; Gain 2 Block or 2 Mana at random");
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
    };
    const luminance = (hex: string) => {
      const [r, g, b] = [0, 2, 4].map((offset) => {
        const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
    };
    for (const id of KEYWORD_IDS) {
      const alias = new RegExp(`--keyword-${id}: var\\(--keyword-([\\w]+)\\);`).exec(tokens);
      const match = new RegExp(`--keyword-${alias?.[1] ?? id}: #([a-f0-9]{6});`).exec(tokens);
      expect(match, id).not.toBeNull();
      // Authored base colors stay exact; other roles must remain readable.
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
