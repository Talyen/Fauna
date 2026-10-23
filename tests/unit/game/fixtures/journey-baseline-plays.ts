import type { Command } from "../../../../src/game/types";

// Inputs captured before runtime simplification (54a2df1); keep policy revisions out of replay baselines.
export const journeyBaselinePlays: Record<number, (Extract<Command, { type: "play" }> | null)[]> = {
  "3": [
    {
      autoEndTurn: false,
      cardId: "ally-0:captoad-attack",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-7:neradora-bloom-shelter",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-14:mossguard-heal",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-14:mossguard-heal",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-14:mossguard-heal",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-14:mossguard-heal",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-7:neradora-bloom-shelter",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-14:mossguard-heal",
      targetId: undefined,
      type: "play",
    },
  ],
  "10": [
    {
      autoEndTurn: false,
      cardId: "ally-0:euphera-twilight-lance",
      targetId: "enemy-0",
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "ally-0:euphera-twilight-lance",
      targetId: "enemy-0",
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-14:dunefox-dune-whirl",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-14:dunefox-attack",
      targetId: "enemy-0",
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-14:dunefox-attack",
      targetId: "enemy-0",
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-14:dunefox-attack",
      targetId: "enemy-0",
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-51:emberback-furnace-breath",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-59:chimecricket-heal",
      targetId: undefined,
      type: "play",
    },
  ],
  "98": [
    {
      autoEndTurn: false,
      cardId: "ally-0:ringpalm-attack",
      targetId: "enemy-0",
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "ally-0:ringpalm-harmonic-set",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "ally-0:ringpalm-attack",
      targetId: "enemy-0",
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-7:prismram-attack",
      targetId: "enemy-0",
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "ally-0:ringpalm-harmonic-set",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-40:dawncall-attack",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-51:emberback-furnace-breath",
      targetId: undefined,
      type: "play",
    },
    {
      autoEndTurn: false,
      cardId: "recruit-62:neradora-bloom-shelter",
      targetId: undefined,
      type: "play",
    },
  ],
};
