import { expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createSession } from "../../../src/application/session";
import { snapshot } from "../../../src/application/cloud-snapshots";
import { createGame, previewCard } from "../../../src/game/engine";
import { encodeSave } from "../../../src/game/save";
import { ordinaryAttackFacts } from "../../../src/game/ability-facts";
import { actionValue, cardCost } from "../../../src/game/ability-rules";
import { definition } from "../../../src/game/content";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import { createSteam } from "../../../desktop/steam.cjs";
import { requireBattle, teamRun } from "../../support/game";

it.each([false, true])(
  "revokes local read admission when a startup subscriber disposes the session (deferred: %s)",
  async (deferred) => {
    const readCandidates = vi.fn(async () => []);
    const session = createSession({
      desktop: false,
      saves: { readCandidates, write: async () => {} },
    });
    session.store.subscribe((view) => {
      if (!view.ready && !view.closing) {
        if (deferred) queueMicrotask(() => void session.dispose());
        else void session.dispose();
      }
    });
    await session.load();
    await session.dispose();
    expect(readCandidates).not.toHaveBeenCalled();
    expect(session.store.getState().ready).toBe(false);
  },
);

it("captures approved cloud parents before asynchronous hashing can change their membership", async () => {
  const identity = {
    device: "a".repeat(32),
    profile: "b".repeat(32),
    available: true,
    importAvailable: false,
  };
  const data = encodeSave(createGame(3));
  const parent = await snapshot(data, identity, 1);
  const foreign = await snapshot(data, { ...identity, profile: "c".repeat(32) }, 1);
  const parents = [parent];
  const constructing = snapshot(data, identity, 2, parents);
  parents.push(foreign);
  expect((await constructing).ancestors).toEqual([parent.id]);
});

it("retires malformed typed Steam replies and settles every pending request immediately", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-reply-boundary-"));
  const previous = process.env.FAUNA_STEAM_APP_ID;
  process.env.FAUNA_STEAM_APP_ID = "999999999";
  const worker = new EventEmitter();
  worker.kill = vi.fn();
  worker.postMessage = vi.fn(({ id, operation }) => {
    if (operation === "init")
      queueMicrotask(() => worker.emit("message", { id, value: "76561190000000000" }));
  });
  let adapter;
  try {
    adapter = await createSteam({
      app: { isPackaged: false },
      directory,
      isolated: false,
      pause() {},
      utilityProcess: { fork: () => worker },
      loadBinding: () => ({ createOverlay: () => ({ account: "76561190000000000", disconnect() {} }) }),
    });
    const pending = Promise.allSettled([adapter.list(), adapter.list()]);
    const request = worker.postMessage.mock.calls.find(([request]) => request.operation === "list")[0];
    worker.emit("message", { id: request.id, value: false });
    await Promise.resolve();
    expect(worker.kill).toHaveBeenCalledOnce();
    expect(await pending).toEqual(
      Array(2).fill({
        status: "rejected",
        reason: expect.objectContaining({ message: "Invalid Steam response." }),
      }),
    );
    await adapter.writeLocal("offline metadata");
    expect(await adapter.readLocal()).toBe("offline metadata");
  } finally {
    await adapter?.dispose();
    if (previous === undefined) delete process.env.FAUNA_STEAM_APP_ID;
    else process.env.FAUNA_STEAM_APP_ID = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

it("lists oversized Cloud slots for per-slot recovery and refuses to download their bytes", async () => {
  const bad = `fauna-v1-${"a".repeat(32)}-0.json`;
  const good = `fauna-v1-${"a".repeat(32)}-1.json`;
  const port = new EventEmitter();
  const replies = [];
  port.postMessage = (reply) => replies.shift()(reply);
  const read = vi.fn(() => "valid backup");
  const cloud = {
    isEnabledForAccount: () => true,
    isEnabledForApp: () => true,
    listFiles: () => [
      { name: bad, size: 1048577n },
      { name: good, size: 100n },
    ],
    fileExists: () => true,
    readFile: read,
  };
  const require = createRequire(import.meta.url);
  vm.runInNewContext(await readFile(new URL("../../../desktop/steam-worker.cjs", import.meta.url), "utf8"), {
    process: { parentPort: port },
    Buffer,
    require: (name) =>
      name === "steamworks.js"
        ? { init: () => ({ cloud, localplayer: { getSteamId: () => ({ steamId64: "76561190000000000" }) } }) }
        : require("../../../desktop/steam-wire.cjs"),
  });
  let id = 0;
  const request = (operation, args = []) =>
    new Promise((resolve) => {
      replies.push(resolve);
      port.emit("message", { data: { id: ++id, operation, args } });
    });
  await request("init", [999999999]);
  expect(await request("list")).toEqual({ id: 2, value: [bad, good] });
  expect(await request("read", [bad])).toEqual({ id: 3, error: "Cloud storage limit exceeded." });
  expect(read).not.toHaveBeenCalled();
  expect(await request("read", [good])).toEqual({ id: 4, value: "valid backup" });
});

it.each([false, true])("ranks Mana-dependent damage after payment, including free plays (%s)", (free) => {
  const state = requireBattle(structuredClone(teamRun(42, ["emberback"])));
  const actor = state.team[0];
  const card = state.cards.find((card) => card.definitionId === "emberback-furnace-breath");
  const def = definition(card.definitionId);
  state.talents = ["mana.manaburn"];
  actor.combat.freeCard = free;
  state.battle.hand = [card.id];
  state.battle.buffer = [];
  state.battle.draw = state.cards.filter((entry) => entry !== card).map((entry) => entry.id);
  state.battle.discard = [];
  state.battle.mana = 2;
  const target = state.battle.enemies[0];
  for (const enemy of state.battle.enemies.slice(1)) enemy.health = 0;
  target.block = 0;
  target.combat.armor = 0;
  const value = actionValue(card, actor, state);
  // Suppress chance outcomes so the assertion compares the ordinary primary packet.
  const actual = previewCard(state, card.id, target.id, () => 0.99);
  const damage = actual.events.find((event) => event.kind === "damage" && event.actorId === actor.id);
  target.health = damage.amount + 1;
  const [facts] = ordinaryAttackFacts(state, actor, def, value, target, cardCost(card, state));
  expect(facts.lost).toBe(damage.amount);
  expect(facts.lethal).toBe(false);
  expect(
    rankedBattleChoices(state, false).find((choice) => choice.command.cardId === card.id)?.reason,
  ).not.toContain("finish");
});
