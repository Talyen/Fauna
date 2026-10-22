import { assetUrl } from "../../src/ui/shared/assets";
import { useRef, useState, useLayoutEffect, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { Coins, Flame, Shield, Leaf, Gem, Feather, Shell, Check } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/components/ui/tooltip";
import { ArtCard } from "../../src/ui/shared/art-card";
import { CreatureDetails } from "../../src/ui/shared/card-details";
import { species, type SpeciesId } from "../../src/game/content";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "./rewards.css";

// Presentation fixtures only. Names, amounts and relic effects are not content decisions.
const keywords = [
  { name: "Fire", icon: Flame, gain: 8, before: 14, threshold: 20, color: "var(--damage-fire)" },
  { name: "Block", icon: Shield, gain: 5, before: 26, threshold: 60, color: "var(--block)" },
  { name: "Nature", icon: Leaf, gain: 3, before: 9, threshold: 20, color: "var(--damage-nature)" },
];
const relics = [
  { name: "Emberstone", icon: Gem, effect: "Your creatures deal 1 additional Fire damage." },
  { name: "Wind Feather", icon: Feather, effect: "Draw one additional card at the start of each battle." },
  { name: "River Shell", icon: Shell, effect: "Your creatures begin each battle with 3 Block." },
];

function Rewards() {
  const [chosen, setChosen] = useState<string | null>(null);
  const [stage, setStage] = useState<"xp" | "recruit" | "relic">("xp");
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    heading.current?.focus();
  }, [stage]);
  return (
    <main className="reward-sample">
      <div className="reward-content">
        <header className="reward-heading">
          <h1 ref={heading} tabIndex={-1}>
            {stage === "xp"
              ? "Rewards"
              : stage === "recruit"
                ? "Recruit"
                : chosen === "skip"
                  ? "Relic skipped"
                  : chosen
                    ? "Relic collected"
                    : "Choose a relic"}
          </h1>
          {stage === "xp" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="reward-currency"
                  aria-label="24 currency earned; 184 total"
                >
                  <Coins aria-hidden="true" /> +24
                </Button>
              </TooltipTrigger>
              <TooltipContent>Permanent currency · 184 total</TooltipContent>
            </Tooltip>
          ) : null}
        </header>
        {stage === "xp" ? (
          <>
            <section className="reward-xp" aria-label="Keyword XP earned">
              {keywords.map(({ name, icon: Icon, gain, before, threshold, color }) => {
                const after = before + gain;
                const earnedPoint = before < 20 && after >= 20;
                const start = earnedPoint ? 20 : before >= 20 ? 20 : 0;
                const end = earnedPoint ? 60 : threshold;
                return (
                  <div
                    className="reward-keyword"
                    key={name}
                    style={{ "--keyword-color": color } as CSSProperties}
                  >
                    <div className="reward-keyword-label">
                      <Icon aria-hidden="true" />
                      <span>{name}</span>
                      <span>+{gain} XP</span>
                    </div>
                    <div
                      className="reward-progress"
                      role="progressbar"
                      aria-label={`${name} talent progress`}
                      aria-valuemin={start}
                      aria-valuemax={end}
                      aria-valuenow={after}
                    >
                      <span style={{ width: `${((after - start) / (end - start)) * 100}%` }} />
                    </div>
                    <div className="reward-progress-detail">
                      <span>{earnedPoint ? "+1 talent point" : ""}</span>
                      <span>
                        {after - start} / {end - start} XP
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>
            <footer className="reward-footer">
              <Button onClick={() => setStage("recruit")}>Continue</Button>
            </footer>
          </>
        ) : null}
        {stage === "recruit" ? (
          <>
            <section className="reward-recruits" aria-label="Defeated species available to recruit">
              {(["pollenmoth", "emberback"] as SpeciesId[]).map((kind) => (
                <Tooltip key={kind}>
                  <TooltipTrigger asChild>
                    <ArtCard
                      aspect="creature"
                      artwork={assetUrl(`creature.${kind}`)}
                      aria-label={`Recruit ${species(kind).name}`}
                      onClick={() => setStage("relic")}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <CreatureDetails kind={kind} />
                  </TooltipContent>
                </Tooltip>
              ))}
            </section>
            <footer className="reward-footer">
              <Button variant="ghost" onClick={() => setStage("relic")}>
                Skip
              </Button>
            </footer>
          </>
        ) : null}
        {stage === "relic" ? (
          <section className="reward-relics" aria-label="Relic reward">
            <div className="reward-relic-options">
              {relics.map(({ name, icon: Icon, effect }) => (
                <Tooltip key={name}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="card"
                      className="reward-relic"
                      aria-label={`${name}: ${effect}`}
                      aria-pressed={chosen === name}
                      aria-disabled={chosen !== null}
                      onClick={() => {
                        if (!chosen) setChosen(name);
                      }}
                    >
                      <span className="reward-relic-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span>{name}</span>
                      <span className="reward-relic-state">
                        {chosen === name ? <Check aria-label="Chosen" /> : null}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <strong>{name}</strong>
                    <p>{effect}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <footer className="reward-footer">
              {chosen ? (
                <span className="reward-result" role="status">
                  {chosen === "skip" ? "Relic skipped" : chosen}
                </span>
              ) : (
                <Button variant="ghost" onClick={() => setChosen("skip")}>
                  Skip
                </Button>
              )}
            </footer>
          </section>
        ) : null}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <TooltipProvider delayDuration={300}>
    <Rewards />
  </TooltipProvider>,
);
