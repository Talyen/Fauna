import { expect, it } from "vitest";
import { produce } from "immer";
import { createSession } from "../../../src/application/session";
import { dispatch } from "../../../src/game/engine";
import { needsCampfire } from "../../../src/game/destinations";
import { species } from "../../../src/game/content";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { GameState } from "../../../src/game/types";
import {
  authoredPack,
  accept,
  bossReward,
  recruitChoice,
  starterJourney,
  winBattle,
  merchantDestination,
  completeRecruitment,
  run,
} from "../../support/game";

it("checks the active team and backups for campfire recovery", () => {
  const state = structuredClone(run());
  for (const unit of state.team) unit.health = species(unit.species).health;
  state.reserves = [{ ...state.team[0]!, id: "backup", health: 0 }];
  expect(needsCampfire(state)).toBe(true);
  state.reserves[0]!.health = species(state.reserves[0]!.species).health;
  expect(needsCampfire(state)).toBe(false);
  state.team[0]!.health = 0;
  expect(needsCampfire(state)).toBe(true);
});

it.each([
  [
    "duplicate Collection record",
    (state: GameState) => state.discovery.encountered.push(state.team[0]!.species),
  ],
  ["unearned journey currency", (state: GameState) => state.journey!.lastBattle!.currency++],
  ["reordered Recruit offers", (state: GameState) => state.reward!.recruits.reverse()],
  ["missing Recruit offer", (state: GameState) => state.reward!.recruits.pop()],
] as const)("rejects %s without altering the intact reward checkpoint", (_, corrupt) => {
  const good = winBattle();
  const saved = encodeSave(good);
  const broken = produce(good, (draft) => {
    corrupt(draft);
  });
  expect(() => decodeSave(encodeSave(broken))).toThrow("Save contains inconsistent game data.");
  const resumed = decodeSave(saved);
  expect(resumed).toEqual(good);
  expect(encodeSave(good)).toBe(saved);
  expect(Object.isFrozen(resumed)).toBe(true);
  expect(Object.isFrozen(resumed.reward!.recruits)).toBe(true);
});

it.each([
  ["missing card zone", (state: GameState) => state.battle!.hand.pop()],
  [
    "duplicate card zone",
    (state: GameState) => {
      const battle = state.battle!;
      battle.draw[0] = battle.hand[0]!;
    },
  ],
  [
    "foreign card zone",
    (state: GameState) => {
      state.battle!.hand[0] = "missing-card";
    },
  ],
  [
    "incorrect permanent kit",
    (state: GameState) => {
      const cards = state.cards.filter((card) => card.ownerId === state.team[0]!.id);
      cards[0]!.definitionId = cards[1]!.definitionId;
    },
  ],
  [
    "recruited creature missing from encounters",
    (state: GameState) => {
      state.discovery.encountered = state.discovery.encountered.filter((id) => id !== state.team[0]!.species);
    },
  ],
  [
    "noncanonical enemy identity",
    (state: GameState) => {
      state.battle!.enemies[0]!.id = "enemy-00";
    },
  ],
  [
    "foreign enemy target",
    (state: GameState) => {
      state.battle!.enemies[0]!.targetId = "missing";
    },
  ],
  [
    "foreign status source",
    (state: GameState) => {
      state.team[0]!.combat!.statusSources.burn = "missing";
    },
  ],
  [
    "foreign Bleed source",
    (state: GameState) => {
      state.team[0]!.combat!.bleed = 1;
      state.team[0]!.combat!.bleedLeech = [{ sourceId: "missing", amount: 1 }];
    },
  ],
] as const)("rejects %s before resuming combat", (_, corrupt) => {
  const good = run();
  expect(decodeSave(encodeSave(good))).toEqual(good);
  const broken = produce(good, (draft) => {
    corrupt(draft);
  });
  expect(() => decodeSave(encodeSave(broken))).toThrow("Save contains inconsistent game data.");
});

it.each(["roster", "destination"] as const)(
  "recovers a backup instead of loading inconsistent %s ownership",
  async (kind) => {
    const good = kind === "roster" ? run() : merchantDestination();
    const corrupt = produce(good, (draft) => {
      if (kind === "roster") delete draft.discovery.recruited[draft.team[1]!.species];
      else draft.expedition.recruit = "memento";
    });
    expect(() => decodeSave(encodeSave(corrupt))).toThrow();
    if (kind === "destination") {
      const result = dispatch(corrupt, { type: "recruitDestination", species: "memento" });
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(corrupt);
    }
    const session = createSession({
      desktop: false,
      saves: {
        readCandidates: async () => [
          { source: "primary", data: encodeSave(corrupt) },
          { source: "backup", data: encodeSave(good) },
        ],
        write: async () => {},
      },
    });
    try {
      await session.load();
      expect(session.store.getState().game).toEqual(good);
    } finally {
      await session.dispose();
    }
  },
);

it.each([
  { controlled: "stun" as const, controlTurns: 0 },
  { controlled: "freeze" as const, controlTurns: 0 },
  { controlled: null, controlTurns: 1 },
  { controlled: null, controlTurns: 2 },
])("rejects contradictory control duration %j", (patch) => {
  const state = accept(starterJourney(3, "captoad"), { type: "beginBattle" });
  const corrupt = produce(state, (draft) => {
    Object.assign(draft.team[0]!.combat!, patch);
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it.each([0, 1, 2])("round-trips a coherent control duration of %s", (turns) => {
  const state = accept(starterJourney(3, "captoad"), { type: "beginBattle" });
  const controlled = produce(state, (draft) => {
    Object.assign(draft.team[0]!.combat!, {
      controlled: turns ? "freeze" : null,
      controlTurns: turns,
    });
  });
  expect(decodeSave(encodeSave(controlled))).toEqual(controlled);
});

it("rejects a victory receipt presented as a returned journey", () => {
  const won = bossReward();
  const corrupt = produce(won, (draft) => {
    draft.phase = "defeat";
    if (draft.journey) draft.journey.outcome = "returned";
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
  expect(decodeSave(encodeSave(accept(won, { type: "abandon" })))).toEqual(accept(won, { type: "abandon" }));
});

it.each([1, 14, 19, 20.5, 41, 1000000])("rejects an impossible Merchant price of %s", (price) => {
  const won = winBattle(accept(starterJourney(3, "captoad"), { type: "beginBattle" }));
  const destinations = accept(
    produce(won, (draft) => {
      draft.rng = 2;
    }),
    recruitChoice(won),
  );
  expect(destinations.support).not.toBeNull();
  expect(decodeSave(encodeSave(destinations))).toEqual(destinations);
  const corrupt = produce(destinations, (draft) => {
    draft.support!.stock[0]!.price = price;
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it("rejects a Merchant discount without Merchant's Favor", () => {
  const won = winBattle(accept(starterJourney(3, "captoad"), { type: "beginBattle" }));
  const destinations = accept(
    produce(won, (draft) => {
      draft.rng = 2;
    }),
    recruitChoice(won),
  );
  const corrupt = produce(destinations, (draft) => {
    for (const slot of draft.support!.stock) slot.price = 13;
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it("keeps the committed full price when Favor is purchased from the current Merchant", () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const won = winBattle(accept(starterJourney(seed, "captoad"), { type: "beginBattle" }));
    const destinations = produce(completeRecruitment(won), (draft) => {
      draft.currency = 40;
    });
    const visit = destinations.support;
    if (!visit) continue;
    const favor = visit.stock.find((slot) => slot.boon === "merchants-favor");
    if (!favor) continue;
    const shopping = accept(destinations, { type: "enterSupport", visit: visit.id });
    const purchased = accept(shopping, { type: "buyBoon", visit: visit.id, slot: favor.slot });
    expect(purchased.support!.stock).toEqual(visit.stock);
    expect(purchased.support!.stock.every((slot) => slot.price >= 20 && slot.price <= 40)).toBe(true);
    expect(decodeSave(encodeSave(purchased))).toEqual(purchased);
    return;
  }
  throw new Error("No seeded Merchant offered Favor");
});

it("rejects a final victory receipt on a Boon choice screen", () => {
  const destinations = produce(starterJourney(3, "captoad"), (draft) => {
    draft.encounter = 29;
    draft.journey!.victories = 29;
    draft.expedition!.pack = authoredPack(draft.encounter);
    draft.expedition.recruit = null;
    draft.support = null;
  });
  const battle = accept(destinations, { type: "beginBattle" });
  const won = dispatch(battle, { type: "devWinBattle" }, true).state;
  expect(decodeSave(encodeSave(won))).toEqual(won);
  const corrupt = produce(won, (draft) => {
    draft.phase = "boon";
    draft.journey!.outcome = null;
    draft.reward!.boons = ["bone-charm"];
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it.each(["control", "reward", "price"])(
  "silently recovers a backup after rejecting corrupt %s data",
  async (kind) => {
    const won = winBattle(accept(starterJourney(3, "captoad"), { type: "beginBattle" }));
    const good =
      kind === "reward"
        ? won
        : accept(
            produce(won, (draft) => {
              draft.rng = 2;
            }),
            recruitChoice(won),
          );
    const corrupt = produce(good, (draft) => {
      if (kind === "control") {
        draft.team[0]!.combat!.controlled = "freeze";
        draft.team[0]!.combat!.controlTurns = 0;
      } else if (kind === "reward") {
        draft.phase = "defeat";
        draft.journey!.outcome = "returned";
      } else draft.support!.stock[0]!.price = 1;
    });
    const writes: string[] = [];
    const session = createSession({
      desktop: false,
      saves: {
        readCandidates: async () => [
          { source: "primary", data: encodeSave(corrupt) },
          { source: "backup", data: encodeSave(good) },
        ],
        write: async (data) => {
          writes.push(data);
        },
      },
    });
    try {
      await session.load();
      expect(session.store.getState().game).toEqual(good);
      expect(session.store.getState()).toMatchObject({ ready: true, error: "" });
      expect(writes).toEqual([]);
    } finally {
      await session.dispose();
    }
  },
);

it.each([999_999, 1_000_000])("keeps final victory saveable with %s previous wins", (wins) => {
  const ready = produce(starterJourney(3, "captoad"), (draft) => {
    draft.encounter = 29;
    draft.expedition = { pack: authoredPack(draft.encounter), recruit: null, lastRoom: null };
    draft.wins = wins;
    draft.journey!.victories = 29;
  });
  const battle = accept(ready, { type: "beginBattle" });
  expect(decodeSave(encodeSave(battle))).toEqual(battle);
  const reward = winBattle(battle);
  expect(decodeSave(encodeSave(reward))).toEqual(reward);
  const won = accept(reward, { type: "recruit", species: reward.reward!.recruits[0]! });
  expect(won.phase).toBe("victory");
  expect(won.wins).toBe(1_000_000);
  expect(decodeSave(encodeSave(won))).toEqual(won);
});

it.each([12, 34])("rejects a price outside the discounted range: %s", (price) => {
  const corrupt = produce(merchantDestination(), (draft) => {
    draft.boons = ["merchants-favor"];
    for (const slot of draft.support!.stock) slot.price = 13;
    draft.support!.stock[0]!.price = price;
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});
