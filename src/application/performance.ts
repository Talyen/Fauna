import { createGame, dispatch } from "../game/engine";
import { CARDS, species, type SpeciesId, definition } from "../game/content";
import { freshCombat } from "../game/combat";
import { encodeSave, decodeSave } from "../game/save";
import { battleChoices } from "./battle-policy";
import type { Command, GameState } from "../game/types";

export function performanceCases() {
  const fixture = structuredClone(createGame(42));
  const kinds: SpeciesId[] = ["mossback", "emberfox", "stormfin", "silkmoth"];
  fixture.roster = kinds;
  fixture.selected = [kinds[0]!];
  fixture.team = kinds.slice(0, 3).map((kind, i) => ({
    id: `ally-${i}`,
    species: kind,
    health: species(kind).health,
    block: 0,
    combat: freshCombat(),
    attacked: false,
  }));
  fixture.reserves = [
    {
      id: "reserve-0",
      species: "silkmoth",
      health: species("silkmoth").health,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    },
  ];
  fixture.lineup = fixture.team.map((c) => c.id);
  fixture.cards = fixture.team.flatMap((c) =>
    CARDS.filter((card) => card.species === c.species).map((card) => ({
      id: `${c.id}:${card.id}`,
      definitionId: card.id,
      ownerId: c.id,
      level: 0,
    })),
  );
  fixture.phase = "teamSelection";
  fixture.expedition = null;
  const started = dispatch(fixture, { type: "beginBattle" });
  if (!started.accepted) throw new Error(started.reason);
  const initial = encodeSave(decodeSave(encodeSave(started.state)));
  const attack = battleChoices(started.state, false).find(
    (c) =>
      c.type === "play" &&
      definition(started.state.cards.find((card) => card.id === c.cardId)!.definitionId).effect === "attack",
  );
  if (!attack || attack.type !== "play") throw new Error("Performance fixture has no attack.");
  const step = (state: GameState, command: Command) => {
    const result = dispatch(state, command);
    if (!result.accepted) throw new Error(result.reason);
    return encodeSave(decodeSave(encodeSave(result.state)));
  };
  const played = step(started.state, attack);
  return [
    {
      id: "battle",
      initial,
      fixture: "explicit-three-deployed-one-reserve-v1",
      actions: [
        { kind: "play", command: attack, checkpoint: played },
        {
          kind: "endTurn",
          command: { type: "endTurn" },
          checkpoint: step(decodeSave(played), { type: "endTurn" }),
        },
      ],
    },
    {
      id: "swap",
      initial,
      fixture: "explicit-three-deployed-one-reserve-v1",
      actions: [
        {
          kind: "swap",
          command: { type: "swap", activeId: "ally-0", reserve: "reserve-0" },
          checkpoint: step(started.state, { type: "swap", activeId: "ally-0", reserve: "reserve-0" }),
        },
      ],
    },
    {
      id: "menus",
      initial,
      fixture: "explicit-three-deployed-one-reserve-v1",
      actions: [
        { kind: "click", name: "Collection", checkpoint: initial },
        { kind: "click", name: "Inspect Mossback", checkpoint: initial },
        { kind: "click", name: "Close inspection", checkpoint: initial },
        { kind: "click", name: "Back", checkpoint: initial },
        { kind: "click", name: "Settings", checkpoint: initial },
        { kind: "click", name: "Close settings", checkpoint: initial },
      ],
    },
  ];
}
