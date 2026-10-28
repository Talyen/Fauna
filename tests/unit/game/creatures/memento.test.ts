import {
  addReserve,
  authoredPack,
  swapFixture,
  accept,
  run,
  teamRun,
  prepareDestination,
} from "../../../support/game";
import { setBattleCards } from "../../../support/cards";
import type { GameEvent } from "../../../../src/game/types";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { createPearls } from "../../../../src/game/combat/legendary";
import { ownedCards } from "../../../../src/game/team";
import { definition, species } from "../../../../src/game/content";
import { draw, drawAtTurnStart } from "../../../../src/game/card-zones";
import { freshCombat } from "../../../../src/game/combat/index";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { battlefield } from "../../../../src/game/battlefield";
import type { BattleState, GameState } from "../../../../src/game/types";
function memento() {
  return produce(teamRun(42, ["memento"]), (state) => {
    state.cards = ownedCards(state.team[0]!.id, "memento");
    state.battle!.hand = state.cards.slice(0, 4).map((card) => card.id);
    state.battle!.draw = state.cards.slice(4).map((card) => card.id);
    state.battle!.discard = [];
    state.battle!.buffer = [];
    state.battle!.enemies.forEach((enemy) => {
      enemy.combat.dodge = 0;
    });
  }) as BattleState;
}
function play(state: GameState, effect: string) {
  const card = state.cards.find((card) => definition(card.definitionId).effect === effect)!;
  const ready = produce(state, (draft) => {
    for (const zone of ["draw", "hand", "discard", "buffer"] as const)
      draft.battle![zone] = draft.battle![zone].filter((id) => id !== card.id);
    draft.battle!.hand.push(card.id);
    draft.battle!.mana = 4;
  });
  const result = dispatch(ready, { type: "play", cardId: card.id, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  return result;
}
describe("Memento and Legendary formations", () => {
  it("owns two of each ability, with unique slots", () => {
    const cards = ownedCards("memento", "memento");
    expect(cards).toHaveLength(6);
    expect(new Set(cards.map((card) => card.id)).size).toBe(6);
    for (const id of new Set(cards.map((card) => card.definitionId)))
      expect(cards.filter((card) => card.definitionId === id)).toHaveLength(2);
  });
  it("summons one Echo per play, attacks exactly once per card and heals only at capacity", () => {
    let state = memento();
    for (let i = 1; i <= 2; i++) {
      const result = play(state, "procession");
      state = result.state as BattleState;
      expect(state.battle.minions).toHaveLength(i);
      expect(result.events.filter((event) => event.text === "The Court Remembers")).toHaveLength(1);
    }
    state = produce(state, (draft) => {
      draft.battle.minions!.forEach((echo) => {
        echo.health = 1;
      });
    });
    state = play(state, "procession").state as BattleState;
    expect(state.battle.minions!.map((echo) => echo.health)).toEqual([6, 6]);
    const ended = accept(state, { type: "endTurn" });
    expect(ended.battle!.minions!.every((echo) => echo.health <= 6)).toBe(true);
  });
  it("consumes a played Pearl after its effect and one court trigger, preserving unplayed Pearls", () => {
    let state = play(memento(), "procession").state;
    const result = play(state, "createPearls");
    state = result.state;
    const pearls = state.cards.filter((card) => definition(card.definitionId).effect === "pearl");
    expect(pearls).toHaveLength(2);
    expect(pearls.every((card) => card.temporary && state.battle!.hand.includes(card.id))).toBe(true);
    const pearlPlay = play(state, "pearl");
    expect(pearlPlay.events.filter((event) => event.text === "The Court Remembers")).toHaveLength(1);
    expect(pearlPlay.state.battle!.mana === 4 || pearlPlay.state.team[0]!.block === 2).toBe(true);
    expect(
      pearlPlay.state.cards.filter((card) => definition(card.definitionId).effect === "pearl"),
    ).toHaveLength(1);
    const consumed = pearls[0]!.id;
    expect(pearlPlay.state.cards.some((card) => card.id === consumed)).toBe(false);
    for (const zone of ["hand", "draw", "discard", "buffer"] as const)
      expect(pearlPlay.state.battle![zone]).not.toContain(consumed);
    expect(decodeSave(encodeSave(pearlPlay.state))).toEqual(pearlPlay.state);
    const replay = dispatch(pearlPlay.state, { type: "play", cardId: consumed });
    expect(replay.accepted).toBe(false);
    expect(replay.state).toBe(pearlPlay.state);
    expect(state.cards).toContain(pearls[0]);
  });
  it("previews consumption without changing the source and rejects an unaffordable Pearl unchanged", () => {
    const state = play(teamRun(42, ["memento"]), "createPearls").state;
    const pearl = state.cards.find((card) => card.temporary)!;
    const before = encodeSave(state);
    const preview = previewCard(state, pearl.id);
    expect(preview).toEqual(dispatch(state, { type: "play", cardId: pearl.id, autoEndTurn: false }));
    expect(encodeSave(state)).toBe(before);
    const empty = produce(state, (draft) => {
      draft.battle!.mana = 0;
    });
    const rejected = dispatch(empty, { type: "play", cardId: pearl.id });
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(empty);
  });
  it("retains Discard until turn-start draws, including unplayed Pearls", () => {
    let state = play(memento(), "createPearls").state as BattleState;
    state = produce(state, (draft) => {
      const cards = draft.cards.map((card) => card.id);
      draft.battle.hand = [];
      draft.battle.buffer = [];
      draft.battle.draw = [cards[0]!];
      draft.battle.discard = cards.slice(1);
      draw(draft, 1);
    });
    expect(state.battle.draw).toEqual([]);
    expect(state.battle.discard).toHaveLength(state.cards.length - 1);
    state = produce(state, (draft) => {
      drawAtTurnStart(draft, 1, []);
    });
    expect(state.battle.discard).toEqual([]);
    expect(
      [...state.battle.draw, ...state.battle.hand].some(
        (id) => state.cards.find((card) => card.id === id)!.temporary,
      ),
    ).toBe(true);
  });
  it("keeps generation capacity available after consumed cards while preserving unique IDs", () => {
    let state = produce(memento(), (draft) => {
      draft.battle.copySerial = 300;
    });
    state = play(state, "createPearls").state as BattleState;
    const first = state.cards.filter((card) => card.temporary).map((card) => card.id);
    expect(first).toHaveLength(2);
    state = play(state, "pearl").state as BattleState;
    state = play(state, "createPearls").state as BattleState;
    expect(state.cards.filter((card) => card.temporary)).toHaveLength(3);
    expect(state.cards.some((card) => card.id === first[0])).toBe(false);
    expect(new Set(state.cards.map((card) => card.id)).size).toBe(state.cards.length);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });
  it("rejects illegal plays without advancing RNG or summoning", () => {
    const state = produce(memento(), (draft) => {
      draft.battle.mana = 0;
    });
    const result = dispatch(state, { type: "play", cardId: state.battle.hand[0]! });
    expect(result.accepted).toBe(false);
    expect(result.state).toBe(state);
  });
  it("deploys a Legendary alone, clears summons on departure and preserves spent slots", () => {
    const initial = produce(run(), (draft) => {
      addReserve(draft, "legend", "memento", 60, freshCombat());
      const cards = draft.cards.map((card) => card.id);
      draft.battle!.hand = cards.slice(0, 2);
      draft.battle!.draw = cards.slice(2, 5);
      draft.battle!.discard = cards.slice(5);
      draft.battle!.buffer = [];
    });
    let state = swapFixture(initial, {
      type: "swap",
      activeId: initial.team[0]!.id,
      reserve: "legend",
    }) as BattleState;
    expect(state.team.map((unit) => unit.id)).toEqual(["legend"]);
    expect(state.reserves).toHaveLength(3);
    expect(state.cards).toHaveLength(6);
    expect(state.battle.hand).toHaveLength(2);
    state = play(state, "procession").state as BattleState;
    state = swapFixture(state, {
      type: "swap",
      activeId: "legend",
      reserve: initial.team[1]!.id,
    }) as BattleState;
    expect(battlefield(state, "player").some((unit) => "minion" in unit)).toBe(false);
    expect(state.cards.every((card) => !card.temporary && card.ownerId === state.team[0]!.id)).toBe(true);
    state = swapFixture(state, { type: "swap", activeId: "", reserve: initial.team[0]!.id }) as BattleState;
    expect(state.team).toHaveLength(2);
    expect(new Set(state.cards.map((card) => card.id)).size).toBe(state.cards.length);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });
  it("promotes retained overflow when a Legendary replaces a hand of temporary copies", () => {
    const initial = produce(run(), (draft) => {
      addReserve(draft, "legend", "memento", 60, freshCombat());
      const cards = draft.cards.map((card) => card.id);
      for (let i = 0; i < 6; i++) draft.cards.push({ ...draft.cards[0]!, id: `copy-${i}`, temporary: true });
      draft.battle!.copySerial = 6;
      draft.battle!.hand = draft.cards.filter((card) => card.temporary).map((card) => card.id);
      draft.battle!.buffer = cards;
      draft.battle!.draw = [];
      draft.battle!.discard = [];
    });
    expect(decodeSave(encodeSave(initial))).toEqual(initial);
    const next = swapFixture(initial, { type: "swap", activeId: initial.team[0]!.id, reserve: "legend" });
    expect(next.battle!.hand).toHaveLength(6);
    expect(next.battle!.buffer).toEqual([]);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it("runs a solo Boss with a six-card deck and offers its recruitment before a Boon", () => {
    let state: GameState = produce(run(), (draft) => {
      draft.encounter = 3;
      draft.expedition = { pack: authoredPack(draft.encounter), recruit: null, lastRoom: "boss" };
      prepareDestination(draft);
      draft.journey!.victories = 3;
    });
    state = accept(state, { type: "beginBattle" });
    expect(state.battle!.enemies).toHaveLength(1);
    expect(state.battle!.enemies[0]!.species).toBe("memento");
    expect(state.battle!.enemies[0]!.deck!.draw).toHaveLength(6);
    state = accept(state, { type: "endTurn" });
    expect(state.battle!.enemies[0]!.deck!.mana).toBeGreaterThanOrEqual(0);
    expect(state.battle!.minions!.some((unit) => unit.minion.side === "enemy")).toBe(true);
    expect(decodeSave(encodeSave(state))).toEqual(state);
    const result = dispatch(state, { type: "devWinBattle" }, true);
    state = result.state;
    expect(state.phase).toBe("recruit");
    expect(state.reward!.recruits).toEqual(["memento"]);
    expect(decodeSave(encodeSave(state))).toEqual(state);
    state = accept(state, { type: "recruit", species: "memento" });
    expect([...state.team, ...state.reserves].map((unit) => unit.species)).toContain("memento");
    expect(state.phase).toBe("boon");
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });
  it("saves player Echoes and Pearls and rejects a forged summoner", () => {
    let state = play(teamRun(42, ["memento"]), "procession").state;
    state = play(state, "createPearls").state;
    expect(decodeSave(encodeSave(state))).toEqual(state);
    const forged = produce(state, (draft) => {
      draft.battle!.minions![0]!.minion.ownerId = "missing";
    });
    expect(() => decodeSave(encodeSave(forged))).toThrow();
  });
  it("consumes boss Pearls, retaining the core kit and an accurate resumable live count", () => {
    const destination = produce(run(), (draft) => {
      draft.encounter = 3;
      draft.expedition = { pack: authoredPack(draft.encounter), recruit: null, lastRoom: "boss" };
      prepareDestination(draft);
      draft.journey!.victories = 3;
    });
    const ready = produce(accept(destination, { type: "beginBattle" }), (draft) => {
      const boss = draft.battle!.enemies[0]!;
      createPearls(draft as BattleState, boss, "enemy", 2, []);
      // End-turn draw takes the two Pearls and two Processions before the draw/generation cards.
      boss.deck!.draw = [
        ...boss.deck!.draw.filter((id) => id !== "memento-lost-procession"),
        "memento-lost-procession",
        "memento-lost-procession",
        ...boss.deck!.hand,
      ];
      boss.deck!.hand = [];
    });
    const result = dispatch(ready, { type: "endTurn" });
    expect(result.events.some((event) => event.actorId === "enemy-0" && event.text.includes("Pearl"))).toBe(
      true,
    );
    const deck = result.state.battle!.enemies[0]!.deck!;
    expect(deck.pearls).toBe(0);
    const zones = [...deck.draw, ...deck.hand, ...deck.discard, ...deck.buffer];
    expect(zones.filter((id) => id === "memento-pearl")).toHaveLength(deck.pearls);
    expect(deck.discard).not.toContain("memento-pearl");
    for (const id of ["memento-lost-procession", "memento-treasury-echo", "memento-drowned-revelation"])
      expect(zones.filter((entry) => entry === id)).toHaveLength(2);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    const forged = produce(result.state, (draft) => {
      draft.battle!.enemies[0]!.deck!.pearls++;
    });
    expect(() => decodeSave(encodeSave(forged))).toThrow();
  });
  it.each([0, 1, 2, 3, 4, 5])(
    "scales the court at passive tier %s and never attacks autonomously",
    (tier) => {
      let state = produce(memento(), (draft) => {
        draft.discovery.recruited.memento = tier + 1;
      });
      const result = play(state, "procession");
      const packet = Array.from(result.events).find(
        (event): event is Extract<GameEvent, { kind: "damage" }> =>
          event.kind === "damage" && !!event.actorId?.startsWith("echo-"),
      );
      expect(packet).toBeDefined();
      expect(packet!.amount).toBe((tier + 3) * (packet!.critical ? 2 : 1));
      expect(result.events.filter((event) => event.text === "The Court Remembers")).toHaveLength(1);
      const end = dispatch(result.state, { type: "endTurn" });
      expect(end.events.filter((event) => event.text === "The Court Remembers")).toHaveLength(0);
    },
  );
  it("allows attacks against enemy Minions and gives them no Death's Door", () => {
    let state = produce(run(), (draft) => {
      draft.battle!.minions = [
        {
          id: "echo-enemy-0-0",
          name: "Echo",
          species: "memento",
          health: 1,
          maxHealth: 6,
          power: 1,
          targetId: draft.team[0]!.id,
          block: 0,
          combat: freshCombat(),
          lastAbility: null,
          minion: { ownerId: "enemy-0", side: "enemy" },
        },
      ];
      draft.battle!.minions[0]!.combat.controlled = "stun";
      draft.battle!.minions[0]!.combat.controlTurns = 1;
      const card = draft.cards.find(
        (card) => definition(card.definitionId).effect === "attack" && !definition(card.definitionId).target,
      )!;
      setBattleCards(draft, [card.id]);
    });
    const result = dispatch(state, {
      type: "play",
      cardId: state.battle!.hand[0]!,
      targetId: "echo-enemy-0-0",
      autoEndTurn: false,
    });
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.minions![0]!.health).toBe(0);
    expect(result.state.battle!.minions![0]!.combat.deathDoorUsed).toBe(false);
  });
  it("supports distinct Legendaries in a full roster while deploying exactly one", () => {
    const initial = produce(teamRun(42, ["tournelle"]), (draft) => {
      for (const [i, kind] of (["euphera", "mossguard", "emberback", "memento"] as const).entries()) {
        addReserve(draft, `reserve-${i}`, kind, species(kind).health, freshCombat());
      }
    });
    const next = swapFixture(initial, { type: "swap", activeId: initial.team[0]!.id, reserve: "reserve-3" });
    expect(next.team).toHaveLength(1);
    expect(next.reserves).toHaveLength(4);
    expect(next.cards).toHaveLength(6);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it("a controlled Boss still restores Mana and draws, without playing cards", () => {
    const destination = produce(run(), (draft) => {
      prepareDestination(draft);
      draft.encounter = 3;
      draft.journey!.victories = 3;
      draft.expedition = { pack: authoredPack(draft.encounter), recruit: null, lastRoom: "boss" };
    });
    const battle = produce(accept(destination, { type: "beginBattle" }), (draft) => {
      const enemy = draft.battle!.enemies[0]!;
      enemy.combat.controlled = "stun";
      enemy.combat.controlTurns = 1;
      enemy.deck!.mana = 0;
    });
    const result = dispatch(battle, { type: "endTurn" });
    expect(result.state.battle!.enemies[0]!.deck!.hand).toHaveLength(4);
    expect(result.state.battle!.enemies[0]!.deck!.mana).toBe(4);
    expect(
      result.events.filter(
        (event): event is Extract<GameEvent, { kind: "action" }> =>
          event.kind === "action" && event.actorId === "enemy-0",
      ),
    ).toEqual([]);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });
});
