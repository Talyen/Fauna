import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Shield, Menu, Crosshair } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../src/components/ui/dialog";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../../src/components/ui/tooltip";
import { ArtCard } from "../../src/ui/art-card";
import { ActionCard } from "../../src/ui/cards";
import { ManaCrystals } from "./mana-crystals";
import { ActionDetails, CreatureDetails } from "../../src/ui/card-details";
import { definition, species, ENCOUNTERS, type SpeciesId } from "../../src/game/content";
import { actionValue } from "../../src/game/rules";
import type { Card, Creature } from "../../src/game/types";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "./layout.css";
import "./mana-crystals.css";

// Deliberately frozen presentation fixtures: no session, commands, persistence or audio.
const team: Creature[] = [
  { id: "ally-0", species: "mossback", health: 26, block: 5, attacked: false },
  { id: "ally-1", species: "emberfox", health: 20, block: 0, attacked: false },
  { id: "ally-2", species: "stormfin", health: 18, block: 0, attacked: false },
];
const hand: Card[] = [
  "mossback-guard",
  "stormfin-attack",
  "emberfox-attack",
  "emberfox-heal",
  "mossback-teamGuard",
].map((id, index) => ({
  id: `sample-${index}`,
  definitionId: id,
  level: 0,
  ownerId: team.find((creature) => creature.species === definition(id).species)!.id,
}));
const enemies = ENCOUNTERS[1].enemies.map((enemy, index) => ({
  ...enemy,
  id: `enemy-${index}`,
  current: [19, 15, 12][index]!,
}));
const params = new URLSearchParams(location.search);

type Inspection = { title: string; content: ReactNode; artwork: ReactNode };
function Battle({ variant, targeting = false }: { variant: "a" | "b"; targeting?: boolean }) {
  const [selected, setSelected] = useState<Card | null>(targeting ? hand[2]! : null);
  const [target, setTarget] = useState("enemy-1");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [pause, setPause] = useState(false);
  const [line, setLine] = useState("");
  const board = useRef<HTMLDivElement>(null);
  const acting = team.find((creature) => creature.id === selected?.ownerId);
  const def = selected ? definition(selected.definitionId) : null;
  const allyTarget = def?.effect === "heal" || def?.effect === "guard";
  const targetKey = allyTarget
    ? target.startsWith("ally")
      ? target
      : "ally-0"
    : target.startsWith("enemy")
      ? target
      : "enemy-1";
  useLayoutEffect(() => {
    const update = () => {
      const root = board.current;
      const actor = root?.querySelector<HTMLElement>(`[data-sample-actor="${acting?.id}"] .creature-card`);
      const recipient = root?.querySelector<HTMLElement>(`[data-sample-actor="${targetKey}"] .creature-card`);
      if (!root || !actor || !recipient || !selected || def?.effect === "teamGuard") {
        setLine("");
        return;
      }
      const origin = root.getBoundingClientRect(),
        a = actor.getBoundingClientRect(),
        b = recipient.getBoundingClientRect();
      const x = a.x + a.width / 2 - origin.x,
        y = a.y - origin.y - 8;
      const endX = allyTarget ? b.x + b.width / 2 - origin.x : b.right - origin.x + 6;
      const endY = allyTarget ? b.y - origin.y - 8 : b.bottom - origin.y - 10;
      const arch = Math.min(y, endY) - 32;
      setLine(
        allyTarget
          ? `M ${x} ${y} C ${x} ${arch}, ${endX} ${arch}, ${endX} ${endY}`
          : `M ${x} ${y} C ${endX} ${y - 24}, ${endX} ${endY + 24}, ${endX} ${endY}`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    if (board.current) observer.observe(board.current);
    return () => observer.disconnect();
  }, [acting, targetKey, selected, allyTarget, def]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (inspection || pause) return;
      if (event.key === "Escape") setSelected(null);
      if (selected && /^(a|d)$/i.test(event.key)) {
        event.preventDefault();
        const prefix = allyTarget ? "ally" : "enemy";
        const current = Number(targetKey.slice(-1));
        setTarget(`${prefix}-${(current + (event.key.toLowerCase() === "a" ? 2 : 1)) % 3}`);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [selected, targetKey, allyTarget, inspection, pause]);
  const inspectCreature = (kind: SpeciesId, name?: string) =>
    setInspection({
      title: `${name ?? species(kind).name} details`,
      artwork: (
        <ArtCard
          aspect="creature"
          artwork={`/art/${kind}.svg`}
          presentation
          aria-label={name ?? species(kind).name}
        />
      ),
      content: <CreatureDetails kind={kind} name={name} />,
    });
  const stats = (id: string, health: number, max: number, block = 0) => {
    const previewing = !!selected && targetKey === id && def?.effect !== "teamGuard";
    let next = health;
    if (previewing && selected && acting && def) {
      const value = actionValue(selected, acting);
      if (def.effect === "attack") next = Math.max(0, health - value);
      if (def.effect === "heal") next = Math.min(max, health + value);
    }
    return (
      <div className="sample-health">
        <div
          className="sample-health-track"
          role="meter"
          aria-label="Health"
          aria-valuenow={health}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <span className="sample-health-fill" style={{ width: `${(next / max) * 100}%` }} />
          {next < health ? (
            <span
              className="sample-health-loss"
              style={{ left: `${(next / max) * 100}%`, width: `${((health - next) / max) * 100}%` }}
            />
          ) : null}
        </div>
        <div className="sample-stats">
          {block > 0 ? (
            <span data-combat-tone="block">
              <Shield aria-hidden="true" />
              {block}
            </span>
          ) : null}
          {previewing && def?.effect === "mark" ? (
            <span>
              <Crosshair aria-hidden="true" />+{actionValue(selected!, acting!)}
            </span>
          ) : null}
          {previewing && def?.effect === "guard" ? (
            <span data-combat-tone="block">
              <Shield aria-hidden="true" />+{actionValue(selected!, acting!)}
            </span>
          ) : null}
        </div>
      </div>
    );
  };
  return (
    <div className={`sample-board sample-${variant}`} ref={board}>
      <header className="sample-status">
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setPause(true)}>
          <Menu />
        </Button>
      </header>
      <section className="sample-enemies" aria-label="Enemy row">
        {enemies.map((enemy) => (
          <article
            key={enemy.id}
            className={`sample-creature ${selected && !allyTarget && targetKey === enemy.id ? "sample-target" : ""}`}
            data-sample-actor={enemy.id}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ArtCard
                  aspect="creature"
                  artwork={`/art/${enemy.species}.svg`}
                  aria-label={selected && !allyTarget ? `Target ${enemy.name}` : `Inspect ${enemy.name}`}
                  onPointerEnter={() => {
                    if (selected && !allyTarget) setTarget(enemy.id);
                  }}
                  onFocus={() => {
                    if (selected && !allyTarget) setTarget(enemy.id);
                  }}
                  onClick={() =>
                    selected ? setTarget(enemy.id) : inspectCreature(enemy.species, enemy.name)
                  }
                />
              </TooltipTrigger>
              {!selected ? (
                <TooltipContent>
                  <CreatureDetails
                    kind={enemy.species}
                    name={enemy.name}
                    health={enemy.current}
                    maxHealth={enemy.health}
                  />
                </TooltipContent>
              ) : null}
            </Tooltip>
            {stats(enemy.id, enemy.current, enemy.health)}
          </article>
        ))}
      </section>
      <div className="sample-command" aria-label="Selected action">
        {selected && def ? (
          <>
            <span>
              {def.name} · {def.cost} mana
            </span>
            <Button onClick={() => setSelected(null)}>Play · Enter</Button>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
          </>
        ) : null}
      </div>
      <section className="sample-players" aria-label="Player row">
        {team.map((creature) => (
          <article
            key={creature.id}
            className={`sample-creature ${acting?.id === creature.id ? "sample-acting" : ""} ${selected && allyTarget && targetKey === creature.id ? "sample-target" : ""}`}
            data-sample-actor={creature.id}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ArtCard
                  aspect="creature"
                  artwork={`/art/${creature.species}.svg`}
                  aria-label={`Inspect ${species(creature.species).name}`}
                  onPointerEnter={() => {
                    if (selected && allyTarget) setTarget(creature.id);
                  }}
                  onFocus={() => {
                    if (selected && allyTarget) setTarget(creature.id);
                  }}
                  onClick={() =>
                    selected && allyTarget ? setTarget(creature.id) : inspectCreature(creature.species)
                  }
                />
              </TooltipTrigger>
              {!selected ? (
                <TooltipContent>
                  <CreatureDetails
                    kind={creature.species}
                    actor={creature}
                    health={creature.health}
                    block={creature.block}
                  />
                </TooltipContent>
              ) : null}
            </Tooltip>
            {stats(creature.id, creature.health, species(creature.species).health, creature.block)}
          </article>
        ))}
      </section>
      <section className="sample-hand-section" aria-label="Action hand">
        <div className="sample-toolbar">
          <ManaCrystals mana={2} />
          <Button onClick={() => setSelected(null)}>End turn</Button>
        </div>
        <div className="sample-fan">
          {hand.map((card, index) => (
            <div
              className="sample-hand-slot"
              key={card.id}
              style={
                {
                  "--fan-angle": `${(index - 2) * 4}deg`,
                  "--fan-drop": `${Math.abs(index - 2) * 7}px`,
                  "--fan-order": index,
                } as React.CSSProperties
              }
            >
              <ActionCard
                card={card}
                ownerName={species(definition(card.definitionId).species).name}
                actor={team.find((creature) => creature.id === card.ownerId)}
                tooltips={!selected}
                selected={selected?.id === card.id}
                onClick={() => setSelected((current) => (current?.id === card.id ? null : card))}
                onInspect={() =>
                  setInspection({
                    title: `${definition(card.definitionId).name} details`,
                    artwork: (
                      <ArtCard
                        aspect="action"
                        artwork={`/art/${definition(card.definitionId).species}-action.svg`}
                        presentation
                        aria-label={definition(card.definitionId).name}
                      />
                    ),
                    content: (
                      <ActionDetails
                        card={card}
                        ownerName={species(definition(card.definitionId).species).name}
                        actor={team.find((creature) => creature.id === card.ownerId)}
                      />
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>
      {line ? (
        <svg className="sample-target-line" aria-hidden="true">
          <defs>
            <marker
              id="target-tip"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 1 1 L 8 5 L 1 9" />
            </marker>
          </defs>
          <path d={line} markerEnd="url(#target-tip)" />
        </svg>
      ) : null}
      <Dialog
        open={!!inspection}
        onOpenChange={(open) => {
          if (!open) setInspection(null);
        }}
      >
        <DialogContent className="sample-inspection">
          <DialogTitle className="sr-only">{inspection?.title}</DialogTitle>
          <DialogDescription className="sr-only">Card information</DialogDescription>
          {inspection?.artwork}
          {inspection?.content}
        </DialogContent>
      </Dialog>
      <Dialog open={pause} onOpenChange={setPause}>
        <DialogContent className="menu-panel" closeLabel="Close menu">
          <DialogTitle className="sr-only">Pause menu</DialogTitle>
          <DialogDescription>Layout sample; no gameplay or saves.</DialogDescription>
          <Button onClick={() => setPause(false)}>Resume</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Gallery() {
  const [targeting, setTargeting] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      root.current
        ?.querySelectorAll<HTMLElement>(".sample-window")
        .forEach((element) =>
          element.style.setProperty("--preview-scale", String(element.clientWidth / 1280)),
        );
    });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  return (
    <main className="sample-gallery" ref={root}>
      <header>
        <h1>Selected battle layout</h1>
        <span>No gameplay or save changes</span>
        <Button variant={targeting ? "outline" : "default"} onClick={() => setTargeting(false)}>
          Idle
        </Button>
        <Button variant={targeting ? "default" : "outline"} onClick={() => setTargeting(true)}>
          Targeting
        </Button>
      </header>
      <div className="sample-comparison">
        {(["a"] as const).map((variant) => (
          <section key={variant}>
            <div className="sample-caption">
              <h2>{variant === "a" ? "A · Equal-height cards" : "B · Larger creatures"}</h2>
              <a
                href={`/design/battle-layout/index.html?variant=${variant}${targeting ? "&state=target" : ""}`}
                target="_blank"
                rel="noreferrer"
              >
                Open full size ↗
              </a>
            </div>
            <div className="sample-window">
              <iframe
                title={`Layout ${variant.toUpperCase()}`}
                src={`/design/battle-layout/index.html?variant=${variant}${targeting ? "&state=target" : ""}`}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <TooltipProvider delayDuration={300}>
    {params.has("compare") ? (
      <Gallery />
    ) : (
      <Battle
        variant={params.get("variant") === "b" ? "b" : "a"}
        targeting={params.get("state") === "target"}
      />
    )}
  </TooltipProvider>,
);
