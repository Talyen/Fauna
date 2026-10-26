import { setBattleCards } from "../../support/cards";
import { expect, it } from "vitest";
import { produce } from "immer";
import { createDiagnostics } from "../../../src/application/diagnostics";
import { definition } from "../../../src/game/content";
import { dispatch } from "../../../src/game/engine";
import { executeAbility } from "../../../src/game/combat/abilities";
import { enemyCardValue } from "../../../src/game/combat/enemy-policy";
import { freshCombat, hit } from "../../../src/game/combat/index";
import { summonEcho } from "../../../src/game/combat/legendary";
import { periodicTick, reducePeriodicStacks, bleedPayments } from "../../../src/game/combat/status-state";
import { observeDecisions } from "../../../src/game/random";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { ownedCards, swapFromCard } from "../../../src/game/team";
import { createSession } from "../../../src/application/session";
import { accept, prepareDestination, requireBattle, run, teamRun } from "../../support/game";

it("Lost Procession heals the surviving Echo while replacing a fallen Echo", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["memento"])));
  const actor = state.team[0]!;
  summonEcho(state, actor, "player", 6, []);
  summonEcho(state, actor, "player", 6, []);
  const [survivor, fallen] = state.battle.minions!;
  survivor!.health = 1;
  fallen!.health = 0;
  summonEcho(state, actor, "player", 6, []);
  expect(state.battle.minions!.map((unit) => unit.health)).toEqual([6, 6]);
});

it("Bleed retains the paid tick's obligations when reactions partially remove the wound", () => {
  const stats = freshCombat();
  stats.bleed = 6;
  stats.bleedLeech = [
    { sourceId: "first", amount: 3 },
    { sourceId: "second", amount: 3 },
  ];
  const captured = periodicTick(stats, "bleed");
  reducePeriodicStacks(stats, "bleed", 2);
  expect(bleedPayments(captured.payouts, 6)).toEqual([
    { sourceId: "first", amount: 3 },
    { sourceId: "second", amount: 3 },
  ]);
  expect(stats.bleedLeech[0]!.amount).toBe(1);
});

it("group healing stops after an overflow Cleanse reaction knocks out the healer", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["neradora", "mossguard", "prismram"])));
  const [actor, first, later] = state.team;
  state.team = [first!, actor!, later!];
  actor!.health = 1;
  actor!.combat!.deathDoorUsed = true;
  later!.health = 10;
  state.talents = ["health.clean-slate"];
  state.boons = ["orbit-armillary", "story-puzzle-cube"];
  state.battle.puzzleProgress = ["burn", "bleed"];
  first!.combat!.poison = 1;
  first!.combat!.statusSources.poison = state.battle.enemies[0]!.id;
  state.battle.enemies[0]!.combat.armor = 1;
  observeDecisions(state, () => 0.99);
  executeAbility(
    state,
    {
      side: "player",
      actor: actor!,
      def: definition("neradora-bloom-shelter"),
      value: 2,
    },
    [],
    { swap: swapFromCard },
  );
  expect(actor!.health).toBe(0);
  expect(later!.health).toBe(9); // Molten Shell lands; the cancelled heal does not
});

it("Passing Flame stops spreading after its first recipient's Molten Shell knocks out Pyrella", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["pyrella", "mossguard", "prismram"])));
  const actor = state.team[0]!;
  actor.health = 1;
  actor.combat!.deathDoorUsed = true;
  const [fallen, shell, later] = state.battle.enemies;
  fallen!.health = 1;
  fallen!.combat = { ...freshCombat(), burn: 20 };
  shell!.species = "emberback";
  shell!.combat = { ...freshCombat(), armor: 1 };
  later!.combat = freshCombat();
  state.boons = ["story-puzzle-cube"];
  state.battle.puzzleProgress = ["poison", "bleed"];
  observeDecisions(state, () => 0.99);
  hit(state, actor, fallen!, 2, "water", [], { origin: "proc" });
  expect(actor.health).toBe(0);
  expect(shell!.combat.burn).toBeGreaterThan(0);
  expect(later!.combat.burn).toBe(0);
});

it("turn exhaustion rejects before mutations and keeps the last battle resumable", () => {
  const before = produce(run(), (draft) => {
    draft.battle!.turn = 1_000_000;
  });
  expect(decodeSave(encodeSave(before))).toEqual(before);
  const result = dispatch(before, { type: "endTurn" });
  expect(result.accepted).toBe(false);
  expect(result.state).toBe(before);
  expect(result.events).toEqual([]);
  expect(decodeSave(encodeSave(result.state))).toEqual(before);
});

it("automatic controlled-turn skipping stops at the final resumable turn", () => {
  const before = produce(run(), (draft) => {
    draft.battle!.turn = 999_999;
    for (const unit of [...draft.team, ...draft.battle!.enemies]) {
      unit.combat!.controlled = "freeze";
      unit.combat!.controlTurns = 2;
    }
  });
  const next = accept(before, { type: "endTurn" });
  expect(next.battle!.turn).toBe(1_000_000);
  expect(decodeSave(encodeSave(next))).toEqual(next);
});

it("spending the last Mana at the turn limit preserves a resumable player window", () => {
  const before = produce(run(), (draft) => {
    draft.battle!.turn = 1_000_000;
    draft.battle!.mana = 1;
    const card = draft.cards.find((entry) => definition(entry.definitionId).effect === "guard")!;
    setBattleCards(draft, [card.id]);
  });
  const next = accept(before, { type: "play", cardId: before.battle!.hand[0]! });
  expect(next.battle!.turn).toBe(1_000_000);
  expect(next.battle!.mana).toBe(0);
  expect(decodeSave(encodeSave(next))).toEqual(next);
});

it("enemy forecasts retire the protection of knocked-out creatures", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = [];
  state.talents = [];
  const target = state.team[0]!;
  target.health = 1;
  target.combat = { ...freshCombat(), deathDoorUsed: true, thorns: 100 };
  for (const unit of [...state.team.slice(1), ...state.battle.enemies]) unit.combat = freshCombat();
  const enemy = state.battle.enemies[0]!;
  const attack = { ...definition("emberback-attack"), damageType: "water" as const };
  expect(enemyCardValue(state, enemy, attack, target.id)).toBeGreaterThan(90);
  expect(target.health).toBe(1);
  expect(target.combat.thorns).toBe(100);
});

it.each(["enemy-0", "echo-ally-0-0"])(
  "rejects reserved roster identity %s before a destination can start combat",
  async (id) => {
    const good = produce(run(), (draft) => {
      prepareDestination(draft);
    });
    const corrupt = produce(good, (draft) => {
      draft.team[0]!.id = id;
      draft.cards = draft.team.flatMap((unit) => ownedCards(unit.id, unit.species));
    });
    expect(() => decodeSave(encodeSave(corrupt))).toThrow();
    const session = createSession({
      desktop: false,
      steam: { available: false },
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
      expect(decodeSave(encodeSave(accept(good, { type: "beginBattle" })))).toBeDefined();
    } finally {
      await session.dispose();
    }
  },
);

it("rejects duplicate Bleed Leech owners instead of accepting ambiguous payment order", () => {
  const corrupt = produce(run(), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.combat.bleed = 6;
    enemy.combat.bleedLeech = [
      { sourceId: draft.team[0]!.id, amount: 2 },
      { sourceId: draft.team[1]!.id, amount: 2 },
      { sourceId: draft.team[0]!.id, amount: 2 },
    ];
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it("redacts lowercase Windows drive paths before persisting diagnostics", () => {
  let stored = "";
  const diagnostics = createDiagnostics({
    read: () => null,
    write: (data) => {
      stored = data;
    },
  });
  diagnostics.record("global", "failed c:\\Users\\private-user\\Saves\\expedition.json");
  expect(diagnostics.snapshot()[0]!.message).not.toContain("private-user");
  expect(diagnostics.snapshot()[0]!.message).toContain("[path]");
  expect(stored).not.toContain("private-user");
});

it("keeps escape-heavy diagnostic history readable after restarting", () => {
  let stored = "";
  const port = {
    read: () => stored,
    write: (data: string) => {
      stored = data;
    },
  };
  const diagnostics = createDiagnostics(port);
  for (let index = 0; index < 50; index++) diagnostics.record("global", `${index}:${"\u0001".repeat(1200)}`);
  expect(stored.length).toBeLessThan(100_000);
  expect(diagnostics.snapshot().length).toBeGreaterThan(0);
  expect(createDiagnostics(port).snapshot()).toEqual(diagnostics.snapshot());
});
