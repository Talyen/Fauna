import { createHash } from "node:crypto";
import { TALENTS } from "../../src/game/content";

// Keep recorded combat and ranking inputs stable; distinct-talents.test.ts covers newer rules.
const newerTalents = new Set([
  "dodge.veil-of-mist",
  "freeze.permafrost",
  "light.daybreak",
  "stun.static-charge",
  "mana.astral-veil",
  "mana.arcane-discharge",
  "physical.savagery",
  "physical.juggernaut",
  "burn.heat-haze",
  "burn.hearthfire",
  "burn.combustion",
  "water.frigid-current",
  "water.storm-surge",
  "water.spring-tide",
  "water.living-water",
]);
export const recordedTalents = TALENTS.filter((talent) => !newerTalents.has(talent.id));

// Keep the recorded gameplay oracle at format 57, excluding only dormant fields.
// The original combat shape had a dormant Water Thorns field immediately after Thorns.
export const recordedTraceDigest = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (key, entry) => {
        // Presentation metadata does not change the recorded combat facts or text.
        if (key === "announcement" && entry?.kind === "useAbility") return undefined;
        if (key === "version") return 57;
        // An unstarted draft is the original default; active-draft resume has focused coverage.
        if (key === "draftStarted" && entry === false) return undefined;
        // Encounter history postdates this combat-only oracle.
        if (key === "encounteredEnemies") return undefined;
        if (
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          Object.hasOwn(entry, "thorns") &&
          Object.hasOwn(entry, "temporaryDodge")
        )
          return Object.fromEntries(
            Object.entries(entry).flatMap(([name, item]) =>
              name === "thorns"
                ? [
                    [name, item],
                    ["waterThorns", 0],
                  ]
                : [[name, item]],
            ),
          );
        if (key === "metronomeActor" && entry === null) return undefined;
        if (key === "fireThorns" && entry === 0) return undefined;
        if (key === "dodgeFreezeRetaliation" && entry === 0) return undefined;
        if (key === "puzzleProgress" && Array.isArray(entry) && entry.length === 0) return undefined;
        if (key === "encoreProgress" && entry === 0) return undefined;
        if (key === "sunwellBonus" && entry === 0) return undefined;
        if (
          [
            "oasisLeech",
            "acrobatReady",
            "moonseedReady",
            "toothpickReady",
            "breadboxReady",
            "starhookReady",
          ].includes(key) &&
          entry === false
        )
          return undefined;
        if (key === "slipperCard" && entry === null) return undefined;
        if (key === "repeatNext" && entry.player === false && entry.enemy === false) return undefined;
        return entry;
      }),
    )
    .digest("hex");
