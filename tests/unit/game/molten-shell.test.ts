import { addBackups, authoredPack, swapFixture } from "../../support/game";
import { expect, it } from "vitest";
import { produce } from "immer";
import { ensureCombat, freshCombat, hit, removeEffects, tickStatuses } from "../../../src/game/combat/index";
import { dispatch, previewCard } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { creaturePassive } from "../../../src/game/progression";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { GameEvent } from "../../../src/game/types";
import { prepareDestination, accept, teamRun } from "../../support/game";

function battle(copies = 1) {
  return accept(
    produce(teamRun(1, ["emberback", "mossguard", "prismram"]), (game) => {
      game.discovery.recruited.emberback = copies;
      prepareDestination(game);
      game.encounter = 2;
      game.journey!.victories = game.encounter;
      game.expedition = {
        recruit: null,
        lastRoom: null,
        pack: authoredPack(
          game.encounter,
          COMBAT_PACKS.findIndex((pack) => pack[0] === "emberback"),
        ),
      };
    }),
    { type: "beginBattle" },
  );
}

it.each([1, 2, 3, 4, 5, 6])(
  "scales Molten Shell with %i collected copies and preserves the active tier across resume",
  (copies) => {
    const game = produce(battle(copies), (draft) => {
      ensureCombat(draft.team[0]!).armor = 1;
      ensureCombat(draft.team[0]!).controlled = "freeze";
      ensureCombat(draft.team[0]!).controlTurns = 1;
    });
    expect(creaturePassive(game, "emberback").description).toBe(
      `When your Armor breaks, deal ${copies} Burn damage to all enemies`,
    );
    const events: GameEvent[] = [];
    const next = produce(decodeSave(encodeSave(game)), (draft) => {
      hit(draft, draft.battle!.enemies[0]!, draft.team[0]!, 5, "physical", events);
    });
    expect(next.team[0]!.health).toBe(26);
    expect(next.team[0]!.combat!.armor).toBe(0);
    expect(
      next.battle!.enemies.map((enemy, index) => game.battle!.enemies[index]!.health - enemy.health),
    ).toEqual([copies, copies, copies]);
    expect(next.battle!.enemies.map((enemy) => enemy.combat.burn)).toEqual([copies, copies, copies]);
    expect(
      events
        .filter((event): event is Extract<GameEvent, { kind: "damage" }> => event.kind === "damage")
        .map((event) => event.targetId),
    ).toEqual(["ally-0", "enemy-0", "enemy-1", "enemy-2"]);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  },
);

it("requires an actual break, can trigger again after gaining new Armor, and never fires after knockout", () => {
  const events: GameEvent[] = [];
  produce(battle(), (draft) => {
    const unit = draft.team[0]!;
    const enemy = draft.battle!.enemies[0]!;
    ensureCombat(unit).controlled = "freeze";
    ensureCombat(unit).controlTurns = 1;
    ensureCombat(unit).armor = 2;
    hit(draft, enemy, unit, 2, "physical", events);
    expect(ensureCombat(unit).armor).toBe(2);
    hit(draft, enemy, unit, 3, "physical", events);
    expect(ensureCombat(unit).armor).toBe(1);
    expect(events.filter((event) => event.kind === "damage" && event.damageType === "burn")).toHaveLength(0);
    hit(draft, enemy, unit, 2, "physical", events);
    expect(
      events.filter(
        (event): event is Extract<GameEvent, { kind: "damage" }> =>
          event.kind === "damage" && event.damageType === "burn",
      ),
    ).toHaveLength(3);
    hit(draft, enemy, unit, 1, "physical", events);
    expect(
      events.filter(
        (event): event is Extract<GameEvent, { kind: "damage" }> =>
          event.kind === "damage" && event.damageType === "burn",
      ),
    ).toHaveLength(3);
    ensureCombat(unit).armor = 1;
    removeEffects(unit, "purge", 1, events, draft);
    expect(
      events.filter(
        (event): event is Extract<GameEvent, { kind: "damage" }> =>
          event.kind === "damage" && event.damageType === "burn",
      ),
    ).toHaveLength(6);
    ensureCombat(unit).armor = 1;
    ensureCombat(unit).deathDoorUsed = true;
    unit.health = 1;
    hit(draft, enemy, unit, 3, "physical", events);
    expect(unit.health).toBe(0);
    expect(
      events.filter(
        (event): event is Extract<GameEvent, { kind: "damage" }> =>
          event.kind === "damage" && event.damageType === "burn",
      ),
    ).toHaveLength(6);
  });
});

it("keeps enemy Molten Shell at its base tier and excludes reserves", () => {
  const game = produce(battle(6), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.combat.armor = 1;
    enemy.combat.controlled = "freeze";
    enemy.combat.controlTurns = 1;
    draft.reserves.push({ ...draft.team[1]!, id: "reserve", combat: freshCombat() });
  });
  const events: GameEvent[] = [];
  const next = produce(game, (draft) => {
    hit(draft, draft.team[0]!, draft.battle!.enemies[0]!, 4, "physical", events);
  });
  expect(next.team.map((ally, index) => game.team[index]!.health - ally.health)).toEqual([1, 1, 1]);
  expect(next.team.map((ally) => ally.combat!.burn)).toEqual([1, 1, 1]);
  expect(next.reserves).toEqual(game.reserves);
});

it("does not activate Molten Shell when periodic damage breaks Armor after swapping into backup", () => {
  const game = produce(battle(6), (draft) => {
    addBackups(draft, {
      ...draft.team[1]!,
      id: "backup-moss",
      species: "captoad",
      health: 20,
      combat: freshCombat(),
    });
    ensureCombat(draft.team[0]!).armor = 1;
    ensureCombat(draft.team[0]!).burn = 1;
  });
  const swapped = swapFixture(game, { type: "swap", activeId: "ally-0", reserve: "backup-moss" });
  const events: GameEvent[] = [];
  const next = produce(swapped, (draft) => tickStatuses(draft, draft.reserves[0]!, events));
  expect(next.reserves[0]!.health).toBe(swapped.reserves[0]!.health - 1);
  expect(next.reserves[0]!.combat!.armor).toBe(0);
  expect(next.battle!.enemies).toEqual(swapped.battle!.enemies);
  expect(decodeSave(encodeSave(next))).toEqual(next);
});

it("resolves opposing Molten Shells once each without a retaliation loop", () => {
  const events: GameEvent[] = [];
  const next = produce(battle(), (draft) => {
    ensureCombat(draft.team[0]!).armor = 1;
    const enemy = draft.battle!.enemies[0]!;
    enemy.combat.armor = 1;
    enemy.combat.controlled = "freeze";
    enemy.combat.controlTurns = 1;
    hit(draft, draft.team[0]!, enemy, 4, "physical", events);
  });
  expect(next.team[0]!.combat!.armor).toBe(0);
  expect(next.battle!.enemies[0]!.combat.armor).toBe(0);
  expect(
    events.filter(
      (event): event is Extract<GameEvent, { kind: "damage" }> =>
        event.kind === "damage" && event.damageType === "burn",
    ),
  ).toHaveLength(6);
});

it.each(["physical", "poison", "freeze", "stun"] as const)(
  "covers Armor removal through %s effects",
  (type) => {
    const events: GameEvent[] = [];
    produce(battle(), (draft) => {
      const enemy = draft.battle!.enemies[0]!;
      enemy.health = type === "freeze" || type === "stun" ? enemy.maxHealth : 18;
      enemy.combat.armor = type === "physical" || type === "poison" ? 2 : 4;
      draft.rng = 1;
      if (type === "physical") draft.boons.push("sundering-charm");
      if (type === "poison") draft.talents.push("poison.caustic");
      if (type === "freeze") draft.talents.push("freeze.brittle-armor");
      if (type === "stun") draft.talents.push("stun.shatter-guard");
      const threshold = Math.ceil(enemy.maxHealth / 2);
      hit(
        draft,
        draft.team[0]!,
        enemy,
        type === "stun" ? threshold + 4 : type === "freeze" ? threshold : 1,
        type,
        events,
      );
      expect(enemy.combat.armor).toBe(0);
      expect(
        events.filter(
          (event) => event.kind === "damage" && event.actorId === "enemy-0" && event.damageType === "burn",
        ),
      ).toHaveLength(3);
    });
  },
);

it("previews Armor theft and commits the same passive burst without mutating the original", () => {
  const withLeech = accept(
    produce(teamRun(1, ["emberback", "emberback", "prismram"]), (draft) => {
      prepareDestination(draft);
      draft.encounter = 2;
      draft.journey!.victories = draft.encounter;
      draft.expedition = {
        recruit: null,
        lastRoom: null,
        pack: authoredPack(
          draft.encounter,
          COMBAT_PACKS.findIndex((pack) => pack[0] === "emberback"),
        ),
      };
      draft.talents.push("leech.armor-siphon");
    }),
    { type: "beginBattle" },
  );
  const ready = produce(withLeech, (draft) => {
    const card = draft.cards.find((card) => card.definitionId === "emberback-attack")!;
    draft.battle!.hand = [card.id];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.battle!.draw = draft.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    draft.battle!.enemies[0]!.combat.armor = 1;
  });
  const original = encodeSave(ready);
  const cardId = ready.battle!.hand[0]!;
  const preview = previewCard(ready, cardId, "enemy-0");
  const result = dispatch(ready, { type: "play", cardId, targetId: "enemy-0", autoEndTurn: false });
  expect(preview.accepted).toBe(true);
  expect(result.accepted).toBe(true);
  expect(result.events).toEqual(preview.events);
  expect(result.state.team).toEqual(preview.state.team);
  expect(
    result.events.filter(
      (event) => event.kind === "damage" && event.actorId === "enemy-0" && event.damageType === "burn",
    ),
  ).toHaveLength(3);
  expect(encodeSave(ready)).toBe(original);
});
