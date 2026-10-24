import { mkdirSync, writeFileSync } from "node:fs";
import { runtime, identity } from "../lib/tool-runtime.mjs";

if (process.env.GITHUB_ACTIONS !== "true")
  throw new Error("Fixture exploration is CI-owned; use the hosted fixture diagnostic workflow");

const server = await runtime();
try {
  const { createGame } = await server.ssrLoadModule("/src/game/engine.ts");
  const { createBattleActor } = await server.ssrLoadModule("/src/application/battle-actor.ts");
  const { accept, policy, FULL_JOURNEY_COMMAND_BUDGET } =
    await server.ssrLoadModule("/tests/support/game.ts");
  const attempts = [];
  let winner;
  // Same actual offers, distinct recruits, policy and command budget as the full browser journey.
  for (let seed = 0; seed < 32; seed++) {
    const initial = createGame(seed);
    const starter = initial.starterOffers[0];
    let game = accept(accept(initial, { type: "draft", species: starter }), { type: "start" });
    const actor = createBattleActor();
    let deployedThree = false;
    let commands = 0;
    while (commands < FULL_JOURNEY_COMMAND_BUDGET && !["victory", "defeat"].includes(game.phase)) {
      deployedThree ||= game.team.length === 3;
      const command =
        game.phase === "recruit" && game.team.length + game.reserves.length < 5
          ? {
              type: "recruit",
              species:
                game.reward.recruits.find(
                  (kind) => ![...game.team, ...game.reserves].some((unit) => unit.species === kind),
                ) ?? game.reward.recruits[0],
            }
          : game.phase === "battle"
            ? actor.choose(game).command
            : policy(game);
      game = accept(game, command);
      commands++;
    }
    const row = {
      seed,
      starter,
      commands,
      phase: game.phase,
      deployedThree,
      roster: [...game.team, ...game.reserves].map((unit) => unit.species),
    };
    attempts.push(row);
    if (game.phase === "victory" && deployedThree && row.roster.length === 5) {
      winner = row;
      break;
    }
  }
  mkdirSync("reports/fixture-diagnostic", { recursive: true });
  writeFileSync(
    "reports/fixture-diagnostic/journey.json",
    JSON.stringify({ sha: process.env.GITHUB_SHA, identity: await identity(), winner, attempts }, null, 2) +
      "\n",
  );
  if (!winner) throw new Error("No full-journey fixture won within the fixed diagnostic budget");
  console.log(JSON.stringify(winner));
} finally {
  await server.close();
}
