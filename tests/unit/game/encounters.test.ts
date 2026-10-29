import { encounterPacks } from "../../support/encounter-packs";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../../src/game/engine";
import {
  JOURNEY_LENGTH,
  bossEncounter,
  encounterSource,
  generateEncounterPack,
  dealsDamage,
} from "../../../src/game/encounters";
import { SPECIES, species, speciesCards } from "../../../src/game/content";
import { observeDecisions } from "../../../src/game/random";
import { addRecruit } from "../../../src/game/team";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { contentCatalog, validateCatalog } from "../../../src/game/content-validation";
import {
  authoredPack,
  completeRecruitment,
  accept,
  winBattle,
  starterJourney,
  teamRun,
  prepareDestination,
} from "../../support/game";

function start(seed = 7) {
  return accept(accept(createGame(seed), { type: "draft", species: createGame(seed).starterOffers[0]! }), {
    type: "start",
  });
}
function enter(s = start()) {
  return accept(s, { type: "beginBattle" });
}

describe("journey encounters", () => {
  it("commits one deterministic encounter and exact enemies, preserved through read-only queries and reload", () => {
    const s = start();
    expect(start()).toEqual(s);
    expect(s.expedition!.pack).not.toBeNull();
    const before = encodeSave(s);
    const preview = encounterSource(s);
    expect(preview.name).toBe("Combat");
    expect(encodeSave(s)).toBe(before);
    const loaded = decodeSave(before);
    expect(loaded).toEqual(s);
    const battle = accept(loaded, { type: "beginBattle" });
    expect(
      battle.battle!.enemies.map(({ name, species, maxHealth, power }) => ({
        name,
        species,
        health: maxHealth,
        power,
      })),
    ).toEqual(preview.enemies.map(({ name, species, health, power }) => ({ name, species, health, power })));
    expect(decodeSave(encodeSave(battle))).toEqual(battle);
  });

  it("draws from every eligible ordinary species and requires two direct attackers in larger groups", () => {
    const base = starterJourney(42, "mossguard");
    const eligible = SPECIES.filter((entry) => !entry.legendary && entry.id !== "mossguard");
    const attackers = new Set(
      eligible.filter((entry) => speciesCards(entry.id).some(dealsDamage)).map((entry) => entry.id),
    );
    const firstRoom = new Set<string>();
    for (let index = 0; index < eligible.length; index++) {
      produce(base, (draft) => {
        observeDecisions(draft, () => (index + 0.5) / eligible.length);
        firstRoom.add(generateEncounterPack(draft)[0]!);
      });
    }
    expect([...firstRoom]).toEqual(eligible.map((entry) => entry.id));

    for (const encounter of [1, 2, 8]) {
      const seen = new Set<string>();
      for (let seed = 0; seed < 200; seed++) {
        produce(base, (draft) => {
          draft.encounter = encounter;
          draft.rng = seed * 87123;
          const pack = generateEncounterPack(draft);
          expect(pack.filter((id) => attackers.has(id)).length).toBeGreaterThanOrEqual(2);
          for (const id of pack) seen.add(id);
        });
      }
      if (encounter > 1) expect([...seen].sort()).toEqual(eligible.map((entry) => entry.id).sort());
    }
  });

  it("reports malformed abilities while checking whether the enemy pool has enough attackers", () => {
    for (const effects of [{ kind: "heal", amount: 2 }, [null], ["damage"]]) {
      const catalog = structuredClone(contentCatalog);
      const card = catalog.cards.find((entry) => entry.id === "mossguard-guard")!;
      Object.assign(card, { effects });
      expect(validateCatalog(catalog)).toContainEqual(
        expect.objectContaining({ id: card.id, field: "effects", severity: "error" }),
      );
    }
  });

  it("allows a support creature in any position when two teammates deal damage", () => {
    const base = starterJourney(42, "mossguard");
    const positions = new Set<number>();
    for (let seed = 0; seed < 500; seed++) {
      produce(base, (draft) => {
        draft.encounter = 2;
        draft.rng = seed * 87123;
        const pack = generateEncounterPack(draft);
        pack.forEach((id, index) => {
          if (id === "neradora") positions.add(index);
        });
      });
    }
    expect([...positions].sort()).toEqual([0, 1, 2]);
  });

  it("can generate repeated creatures without using a fixed lineup", () => {
    const state = produce(starterJourney(42, "mossguard"), (draft) => {
      draft.encounter = 2;
      observeDecisions(draft, () => 0);
      const pack = generateEncounterPack(draft);
      expect(pack).toEqual([pack[0], pack[0], pack[0]]);
    });
    expect(state.encounter).toBe(2);
  });

  it("excludes the full roster from generated packs, including backups and knocked-out creatures", () => {
    for (const kinds of [
      ["mossguard", "emberback", "prismram", "pollenmoth", "captoad"],
      ["memento", "dunefox", "reedstag", "cadenza", "coralcurl"],
    ] as const) {
      for (let encounter = 0; encounter < JOURNEY_LENGTH; encounter++) {
        for (let seed = 0; seed < 32; seed++) {
          const state = produce(teamRun(seed, [...kinds]), (draft) => {
            prepareDestination(draft);
            draft.encounter = encounter;
            draft.journey!.victories = encounter;
            draft.team[0]!.health = 0;
            draft.reserves = draft.team.splice(1);

            draft.expedition = { pack: generateEncounterPack(draft), recruit: null, lastRoom: null };
          });
          const pack = state.expedition!.pack!;
          expect(pack).toHaveLength(bossEncounter(state) ? 1 : Math.min(3, encounter + 1));
          expect(
            pack.every(
              (kind) => ![...state.team, ...state.reserves].map((unit) => unit.species).includes(kind),
            ),
          ).toBe(true);
          expect(enter(state).battle!.enemies.map((enemy) => enemy.species)).toEqual(pack);
        }
      }
    }
  });

  it.each([
    [9, "memento"],
    [19, "velvetmonarch"],
    [29, "chronora"],
  ] as const)("excludes an owned Legendary from the Boss at encounter %s", (encounter, boss) => {
    const started = starterJourney(7, boss);
    const ready = produce(started, (draft) => {
      draft.encounter = encounter;
      draft.journey!.victories = encounter;
      draft.expedition!.pack = generateEncounterPack(draft, [boss]);
      draft.expedition.recruit = null;
      draft.support = null;
    });
    const source = encounterSource(ready);
    expect(source.name).toBe("Boss");
    expect(source.enemies).toHaveLength(1);
    expect(source.enemies[0]!.species).not.toBe(boss);
    expect(source.enemies[0]!.name).toBe(species(source.enemies[0]!.species).name);
    const battle = enter(decodeSave(encodeSave(ready)));
    expect(decodeSave(encodeSave(battle))).toEqual(battle);
    const result = dispatch(battle, { type: "devWinBattle" }, true);
    expect(result.accepted).toBe(true);
    const reward = result.state;
    expect(reward.reward!.currency).toBe(40);
    expect(reward.reward!.recruits).toEqual(ready.expedition!.pack);
    expect(decodeSave(encodeSave(reward))).toEqual(reward);
  });

  it("uses an unowned Boss if available and falls back to all Bosses only when the roster has them all", () => {
    for (const encounter of [9, 19, 29]) {
      for (const owned of [
        ["memento", "chronora"],
        ["memento", "chronora", "velvetmonarch"],
      ] as const) {
        const found = new Set<string>();
        for (const decision of [0.1, 0.5, 0.9]) {
          produce(teamRun(42, [...owned]), (draft) => {
            prepareDestination(draft);
            draft.reserves = draft.team.splice(1);
            draft.reserves[0]!.health = 0;
            draft.encounter = encounter;
            observeDecisions(draft, () => decision);
            found.add(generateEncounterPack(draft)[0]!);
          });
        }
        expect([...found].sort()).toEqual(
          owned.length === 2 ? ["velvetmonarch"] : ["chronora", "memento", "velvetmonarch"],
        );
      }
    }
  });

  it("saves and plays the fallback Boss when all Legendaries are on the roster", () => {
    const ready = produce(starterJourney(7, "memento"), (draft) => {
      for (const kind of ["chronora", "velvetmonarch"] as const) {
        addRecruit(draft, kind);
        draft.discovery.encountered.push(kind);
        draft.discovery.recruited[kind] = 1;
      }
      draft.encounter = 9;
      draft.journey!.victories = 9;
      draft.expedition.pack = generateEncounterPack(draft);
      draft.expedition.recruit = null;
      draft.support = null;
    });
    const battle = enter(decodeSave(encodeSave(ready)));
    const enemy = battle.battle!.enemies[0]!.species;
    expect([...battle.team, ...battle.reserves].some((unit) => unit.species === enemy)).toBe(true);
    const result = dispatch(battle, { type: "devWinBattle" }, true);
    expect(result.accepted).toBe(true);
    const recruited = accept(result.state, { type: "recruit", species: enemy });
    expect(recruited.discovery.recruited[enemy]).toBe(2);
    expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
  });

  it("advances after an optional recruit and persists the next pack", () => {
    const ready = produce(start(), (draft) => {
      draft.encounter = 2;
      draft.journey!.victories = 2;
      draft.expedition!.pack = ["captoad", "dunefox", "captoad"];
      draft.expedition!.recruit = "captoad";
      draft.expedition!.lastRoom = "combat";
    });
    const command = { type: "recruitDestination", species: "captoad" } as const;
    const recruited = accept(ready, command);
    expect(accept(ready, command)).toEqual(recruited);
    const pack = recruited.expedition!.pack!;
    expect(pack).toHaveLength(3);
    expect(recruited.encounter).toBe(3);
    expect(
      pack.every(
        (kind) => ![...recruited.team, ...recruited.reserves].map((unit) => unit.species).includes(kind),
      ),
    ).toBe(true);
    expect(decodeSave(encodeSave(recruited))).toEqual(recruited);
    const battle = enter(recruited);
    expect(battle.battle!.enemies.map((enemy) => enemy.species)).toEqual(pack);
    expect(decodeSave(encodeSave(battle))).toEqual(battle);
  });

  it("persists explicit room power and scales base Health by 10 percent per room", () => {
    const initial = start();
    for (let encounter = 0; encounter < JOURNEY_LENGTH; encounter++) {
      for (let pack = 0; pack < encounterPacks(encounter).length; pack++) {
        const state = produce(initial, (draft) => {
          draft.encounter = encounter;
          draft.journey!.victories = draft.encounter;
          draft.expedition!.pack = authoredPack(draft.encounter, pack);
          if (bossEncounter(draft)) {
            draft.expedition.recruit = null;
            draft.support = null;
          }
        });
        const battle = enter(state);
        for (const enemy of battle.battle!.enemies) {
          const health = Math.round(species(enemy.species).health * (1 + encounter * 0.1));
          expect(enemy.health).toBe(health);
          expect(enemy.maxHealth).toBe(health);
          expect(enemy.power).toBe(1 + encounter / 10);
        }
      }
    }
  });

  it("rejects entry outside the encounter screen without consuming RNG or changing state", () => {
    for (const s of [createGame(), enter()]) {
      const result = dispatch(s, { type: "beginBattle" });
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(s);
    }
  });

  it("runs thirty rooms with three bosses and advances only after completing rewards", () => {
    let s = start();
    let earnings = 0;
    for (let index = 0; index < JOURNEY_LENGTH; index++) {
      expect(s.encounter).toBe(index);
      if (s.support) expect(s.support.encounter).toBe(index);
      expect(encounterSource(s).name).toBe(index % 10 === 9 ? "Boss" : "Combat");
      expect(encounterSource(s).enemies).toHaveLength(index % 10 === 9 ? 1 : Math.min(3, index + 1));
      if (!bossEncounter(s))
        expect(
          encounterSource(s).enemies.every(
            (enemy) => ![...s.team, ...s.reserves].map((unit) => unit.species).includes(enemy.species),
          ),
        ).toBe(true);
      expect(decodeSave(encodeSave(enter(s)))).toEqual(enter(s));
      const route = enter(s).expedition;
      s = winBattle(enter(s));
      expect(["recruit", "boon", "teamSelection", "victory"]).toContain(s.phase);
      earnings += [9, 19, 29].includes(index) ? 40 : 20;
      expect(s.currency).toBe(earnings);
      if (s.phase !== "teamSelection") expect(s.expedition).toEqual(route);
      expect(decodeSave(encodeSave(s))).toEqual(s);
      if (s.phase === "recruit") {
        s =
          s.team.length + s.reserves.length < 3
            ? accept(s, { type: "recruit", species: s.reward!.recruits[0]! })
            : completeRecruitment(s);
        expect(decodeSave(encodeSave(s))).toEqual(s);
      }
      if (s.phase === "boon") s = accept(s, { type: "skipBoon" });
      expect(decodeSave(encodeSave(s))).toEqual(s);
      if (index < JOURNEY_LENGTH - 1) {
        expect(s.phase).toBe("teamSelection");
        expect(s.expedition!.pack).not.toBeNull();
      }
    }
    expect(s.phase).toBe("victory");
    expect(s.wins).toBe(1);
  });

  it("rejects forged packs, progress and enemy receipts", () => {
    const s = enter();
    for (const mutate of [
      (d: typeof s) => {
        d.expedition!.pack = ["memento"];
      },
      (d: typeof s) => {
        d.encounter = 2;
        d.journey!.victories = d.encounter;
      },
      (d: typeof s) => {
        d.battle!.enemies[0]!.power++;
      },
      (d: typeof s) => {
        d.battle!.enemies[0]!.maxHealth++;
      },
      (d: typeof s) => {
        d.expedition!.pack = null;
      },
    ])
      expect(() => decodeSave(encodeSave(produce(s, mutate)))).toThrow();
  });

  it("rejects obsolete destination and biome saves", () => {
    for (const version of [16, 17, 18, 38, 51])
      expect(() => decodeSave(JSON.stringify({ ...start(), version }))).toThrow();
  });

  it("allows abandonment before entering combat", () => {
    const abandoned = accept(start(), { type: "abandon" });
    expect(decodeSave(encodeSave(abandoned))).toEqual(abandoned);
  });
});
