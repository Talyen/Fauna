import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { produce } from "immer";
import { expect, it } from "vitest";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { createGame } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import saveFormat from "../../../src/game/save-format.json";
import { createTemporaryCard, draw, MAX_BATTLE_CARDS } from "../../../src/game/card-zones";
import { createFood } from "../../../src/game/combat/food";
import { createPearls } from "../../../src/game/combat/legendary";
import { waterFollowups } from "../../../src/game/combat/damage-reactions";
import { resolveCombat } from "../../../src/game/combat/resolution";
import { observeDecisions } from "../../../src/game/random";
import { TALENTS } from "../../../src/game/content";
import {
  accept,
  authoredPack,
  enemyPlay,
  prepareDestination,
  requireBattle,
  run,
  teamRun,
} from "../../support/game";
import { setBattleCards } from "../../support/cards";

const require = createRequire(import.meta.url);
const { createStorage } = require("../../../desktop/storage.cjs");

it("refuses an oversized browser save before touching the intact primary or backups", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } as unknown as Storage;
  const saves = createBrowserPlatform(storage).saves;
  const data = encodeSave(createGame(42));
  const exact = data.padEnd(saveFormat.maxBytes);
  expect(decodeSave(exact)).toEqual(createGame(42));
  await saves.write(exact);
  const before = new Map(values);
  await expect(saves.write(exact + " ", () => true)).rejects.toThrow("Invalid save payload");
  expect(values).toEqual(before);
  // UTF-8 bytes, rather than JS string length, own the storage boundary
  await expect(saves.write("é".repeat(saveFormat.maxBytes / 2 + 1))).rejects.toThrow();
});

it("uses the same exact UTF-8 save boundary in native storage and decoding", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-save-boundary-"));
  try {
    const storage = createStorage(directory);
    const exact = encodeSave(createGame(42)).padEnd(saveFormat.maxBytes);
    await storage.write(exact);
    await expect(storage.write(exact + " ")).rejects.toThrow("Invalid save payload");
    expect(() => decodeSave(exact + " ")).toThrow("supported size");
    expect((await storage.readCandidates())[0]!.data).toBe(exact);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("shares generated identities across Food and Well Read, including serial exhaustion", () => {
  const before = requireBattle(teamRun(42, ["rookhaven", "coralcurl", "mossguard"]));
  const next = produce(before, (draft) => {
    draft.discovery.recruited.rookhaven = 6;
    setBattleCards(draft, []);
    const serial = draft.battle.copySerial;
    createFood(draft, draft.team[0]!, 1, []);
    draw(draft, 1);
    expect(
      draft.cards
        .filter((card) => card.temporary)
        .slice(-2)
        .map((card) => card.id),
    ).toEqual([`copy-${serial}`, `copy-${serial + 1}`]);
    draft.battle.copySerial = Number.MAX_SAFE_INTEGER - 1;
    const last = createTemporaryCard(draft, draft.cards[0]!);
    expect(last?.id).toBe(`copy-${Number.MAX_SAFE_INTEGER - 1}`);
    const rng = draft.rng;
    createFood(draft, draft.team[0]!, 1, []);
    expect(createTemporaryCard(draft, draft.cards[0]!)).toBeUndefined();
    expect(draft.rng).toBe(rng);
    // The allocator owns insertion; put this deliberately unreceived slot in a zone
    draft.battle.draw.push(last!.id);
  });
  expect(new Set(next.cards.map((card) => card.id)).size).toBe(next.cards.length);
  expect(decodeSave(encodeSave(next))).toEqual(next);
});

it("keeps the permanent Boss kit intact when Pearl generation fills the battle-card budget", () => {
  const destination = produce(run(), (draft) => {
    prepareDestination(draft);
    draft.encounter = 9;
    draft.journey!.victories = 9;
    draft.expedition.pack = authoredPack(9);
  });
  const before = requireBattle(accept(destination, { type: "beginBattle" }));
  const next = produce(before, (draft) => {
    createPearls(draft, draft.battle.enemies[0]!, "enemy", MAX_BATTLE_CARDS, []);
  });
  const deck = next.battle.enemies[0]!.deck!;
  expect(deck.pearls).toBe(MAX_BATTLE_CARDS - 6);
  expect([...deck.hand, ...deck.draw, ...deck.buffer, ...deck.discard]).toHaveLength(MAX_BATTLE_CARDS);
  expect(decodeSave(encodeSave(next))).toEqual(next);
  const restored = enemyPlay(next, "memento-pearl", { decisions: () => 0.75 }).state;
  expect(restored.battle!.enemies[0]!.deck!.mana).toBe(4);
  const overMana = produce(next, (draft) => {
    draft.battle.enemies[0]!.deck!.mana = 5;
  });
  expect(() => decodeSave(encodeSave(overMana))).toThrow();
  const corrupt = produce(next, (draft) => {
    draft.battle.enemies[0]!.deck!.pearls++;
    draft.battle.enemies[0]!.deck!.buffer.push("memento-pearl");
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it("stops Riptide and its RNG after a nested Cleanse reaction defeats the Water source", () => {
  const before = produce(requireBattle(teamRun(42, ["bloomquail", "coralcurl", "mossguard"])), (draft) => {
    draft.discovery.recruited.bloomquail = 6;
    draft.keywordXP.water = 1000;
    draft.talents = TALENTS.filter((talent) => talent.keyword === "water").map((talent) => talent.id);
    draft.boons = ["orbit-armillary", "story-puzzle-cube"];
    draft.battle.puzzleProgress = ["burn", "bleed"];
    draft.battle.enemies[0]!.combat.armor = 1;
    draft.team[0]!.health = 1;
    draft.team[0]!.combat!.deathDoorUsed = true;
    draft.team[0]!.combat!.poison = 1;
    draft.team[0]!.combat!.statusSources.poison = draft.battle.enemies[0]!.id;
    draft.team[2]!.health = 1;
    setBattleCards(draft, []);
  });
  expect(decodeSave(encodeSave(before))).toEqual(before);
  let decisions = 0;
  const next = produce(before, (draft) => {
    observeDecisions(draft, () => {
      decisions++;
      return 0;
    });
    // Exercise the Water reaction boundary directly so the lethal nested child is isolated
    const followups = waterFollowups(
      {
        state: draft,
        source: draft.team[0]!,
        target: draft.battle.enemies[0]!,
        type: "water",
        events: [],
      },
      () => {},
    );
    for (const operation of followups) resolveCombat(operation.kind, ...operation.args);
  });
  expect(next.team[0]!.health).toBe(0);
  expect(next.battle.hand).toEqual([]);
  expect(decisions).toBe(1);
  expect(decodeSave(encodeSave(next))).toEqual(next);
});
