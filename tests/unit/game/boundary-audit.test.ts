import { setBattleCards } from "../../support/cards";
import { expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import { produce } from "immer";
import { createDiagnostics } from "../../../src/application/diagnostics";
import { definition } from "../../../src/game/content";
import { dispatch, previewCard } from "../../../src/game/engine";
import { executeAbility } from "../../../src/game/combat/abilities";
import { enemyCardValue } from "../../../src/game/combat/enemy-policy";
import { freshCombat, hit } from "../../../src/game/combat/index";
import { summonEcho } from "../../../src/game/combat/legendary";
import { periodicTick, reducePeriodicStacks, bleedPayments } from "../../../src/game/combat/status-state";
import { observeDecisions } from "../../../src/game/random";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { ownedCards } from "../../../src/game/team";
import { createSession } from "../../../src/application/session";
import { accept, authoredPack, prepareDestination, requireBattle, run, teamRun } from "../../support/game";

it("Lost Procession replaces a fallen Echo without healing the survivor while a space is open", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["memento"])));
  const actor = state.team[0]!;
  summonEcho(state, actor, "player", 6, []);
  summonEcho(state, actor, "player", 6, []);
  const [survivor, fallen] = state.battle.minions!;
  survivor!.health = 1;
  fallen!.health = 0;
  summonEcho(state, actor, "player", 6, []);
  expect(state.battle.minions!.map((unit) => unit.health)).toEqual([1, 6]);
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

it.each([12, 20, 25])(
  "reflected Valiant Challenge compares its new recipient against the reflector (%i Health)",
  (health) => {
    const before = produce(requireBattle(teamRun(42, ["tournelle"])), (draft) => {
      const card = draft.cards.find((entry) => entry.definitionId === "tournelle-attack")!;
      draft.battle.hand = [card.id];
      draft.battle.buffer = [];
      draft.battle.discard = [];
      draft.battle.draw = draft.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
      draft.team[0]!.health = 20;
      draft.team[0]!.block = 0;
      draft.team[0]!.combat = freshCombat();
      const target = draft.battle.enemies[0]!;
      target.health = health;
      target.block = 0;
      target.combat = { ...freshCombat(), attackReflection: true };
      draft.rng = 42;
    });
    expect(decodeSave(encodeSave(before))).toEqual(before);
    const cardId = before.battle.hand[0]!;
    const targetId = before.battle.enemies[0]!.id;
    const result = dispatch(before, { type: "play", cardId, targetId, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.health).toBe(20 - (20 > health ? 8 : 4));
    expect(previewCard(before, cardId, targetId)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  },
);

it("retains Water's Moonboat protection when a reflected attack meets Negate", () => {
  const destination = produce(teamRun(42, ["oathara"]), (draft) => {
    prepareDestination(draft);
    draft.expedition.pack = ["almanelle", "pollenmoth", "mossguard"];
  });
  const state = structuredClone(requireBattle(accept(destination, { type: "beginBattle" })));
  state.boons = ["moonboat-toy"];
  const ally = state.team[0]!;
  const enemy = state.battle.enemies[0]!;
  ally.combat = { ...freshCombat(), attackReflection: true };
  enemy.combat = { ...freshCombat(), negate: true, thorns: 6 };
  const health = ally.health;
  const events: import("../../../src/game/types").GameEvent[] = [];
  observeDecisions(state, () => 0.99);
  executeAbility(
    state,
    { side: "enemy", actor: enemy, def: definition("almanelle-spring-current"), value: 4, targetId: ally.id },
    events,
  );
  expect(ally.health).toBe(health);
  expect(ally.combat.burn).toBe(0);
  expect(enemy.combat).toMatchObject({ negate: false, thorns: 5 });
  expect(events.filter((event) => event.kind === "damage")).toEqual([]);
  expect(decodeSave(encodeSave(state))).toEqual(state);
});

it.each(["area", "bounce"] as const)(
  "%s delivery stops targeting Echoes when their summoner falls",
  (delivery) => {
    const destination = produce(teamRun(42, [delivery === "area" ? "captoad" : "pollenmoth"]), (draft) => {
      prepareDestination(draft);
      draft.encounter = 9;
      draft.journey!.victories = 9;
      draft.expedition = { pack: authoredPack(9), recruit: null, lastRoom: "boss" };
      if (delivery === "bounce") draft.discovery.recruited.pollenmoth = 3;
    });
    const state = structuredClone(requireBattle(accept(destination, { type: "beginBattle" })));
    const actor = state.team[0]!;
    const boss = state.battle.enemies[0]!;
    boss.health = 1;
    boss.block = 0;
    boss.combat = freshCombat();
    summonEcho(state, boss, "enemy", 6, []);
    summonEcho(state, boss, "enemy", 6, []);
    const [first, later] = state.battle.minions!;
    later!.combat.thorns = 10;
    later!.combat.negate = true;
    later!.combat.attackReflection = true;
    const health = actor.health;
    const events: import("../../../src/game/types").GameEvent[] = [];
    expect(decodeSave(encodeSave(state))).toEqual(state);
    observeDecisions(state, (decision) => (decision?.kind === "index" ? 0 : 0.99));
    if (delivery === "bounce") hit(state, actor, first!, 2, "light", events);
    else
      executeAbility(state, { side: "player", actor, def: definition("captoad-attack"), value: 2 }, events);
    expect(boss.health).toBe(0);
    expect(later!.health).toBe(6);
    expect(later!.combat).toMatchObject({ negate: true, attackReflection: true, thorns: 10 });
    expect(actor.health).toBe(health);
    expect(events.some((event) => event.kind === "damage" && event.targetId === later!.id)).toBe(false);
  },
);

it.each([false, true])(
  "drains admitted saves when renderer close notification fails (send failure: %s)",
  async (sendFails) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const storage = { drain: vi.fn(() => pending) };
    const app = Object.assign(new EventEmitter(), {
      setName() {},
      requestSingleInstanceLock: () => true,
      whenReady: () => new Promise(() => {}),
      quit: vi.fn(),
    });
    const send = vi.fn(() => {
      if (sendFails) throw new Error("Renderer disappeared");
    });
    const nativeRequire = createRequire(import.meta.url);
    const context = vm.createContext({
      require: (name: string) =>
        name === "electron"
          ? { app, protocol: { registerSchemesAsPrivileged() {} } }
          : name.startsWith("./")
            ? {}
            : nativeRequire(name),
      process: { env: { FAUNA_DISABLE_STEAM: "1" } },
      __dirname: "/fauna/desktop",
      resources: { storage, window: { isDestroyed: () => false, webContents: { send } } },
    });
    try {
      vm.runInContext(await readFile(new URL("../../../desktop/main.cjs", import.meta.url), "utf8"), context);
      expect(() =>
        vm.runInContext(
          "storage = resources.storage; window = resources.window; requestClose(); requestClose();",
          context,
        ),
      ).not.toThrow();
      if (!sendFails) vm.runInContext("finishClose();", context);
      await new Promise((resolve) => setImmediate(resolve));
      expect(send).toHaveBeenCalledOnce();
      expect(storage.drain).toHaveBeenCalledOnce();
      expect(app.quit).not.toHaveBeenCalled();
      release();
      await new Promise((resolve) => setImmediate(resolve));
      expect(app.quit).toHaveBeenCalledOnce();
    } finally {
      release();
    }
  },
);
