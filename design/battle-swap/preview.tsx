import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../../src/components/ui/dialog";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { BattleScreen } from "../../src/ui/battle/battle-screen";
import type { Controls } from "../../src/ui/shared/input";
import { CreatureCard } from "../../src/ui/shared/cards";
import { createGame, dispatch } from "../../src/game/engine";
import { CARDS, species } from "../../src/game/content";
import type { Creature, GameState } from "../../src/game/types";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "../../src/ui/battle/mana-crystals.css";
import "./swap.css";

// Presentation sandbox only. No persistence, production swap command, or progression changes.
function fixture(): GameState {
  let game = createGame(71);
  for (const kind of ["mossguard", "emberback", "prismram"] as const)
    game = dispatch(game, { type: "draft", species: kind }).state;
  game = dispatch(game, { type: "start" }).state;
  game = dispatch({ ...game, encounter: 1 }, { type: "beginBattle" }).state;
  return {
    ...game,
    roster: ["mossguard", "emberback", "prismram", "pollenmoth", "emberback"],
    team: game.team.map((creature, index) => ({
      ...creature,
      health: index === 1 && new URLSearchParams(location.search).has("ko") ? 0 : [26, 12, 19][index]!,
    })),
  };
}

function Preview() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.input;
    const pointer = () => {
      root.dataset.input = "pointer";
    };
    const keyboard = () => {
      root.dataset.input = "keyboard";
    };
    pointer();
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard, true);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", keyboard, true);
      if (previous === undefined) delete root.dataset.input;
      else root.dataset.input = previous;
    };
  }, []);
  const [game, setGame] = useState(fixture);
  const [reserves, setReserves] = useState<Creature[]>([
    { id: "reserve-pollenmoth", species: "pollenmoth", health: 18, block: 0, attacked: false },
    { id: "reserve-emberback", species: "emberback", health: 28, block: 0, attacked: false },
  ]);
  const [open, setOpen] = useState(new URLSearchParams(location.search).has("open"));
  const [selected, setSelected] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const controls: Controls = useRef(null);
  const activeSelected = game.team.some((creature) => creature.id === selected);
  const choose = (creature: Creature, active: boolean) => {
    if (!selected || active === activeSelected) {
      setSelected(selected === creature.id ? null : creature.id);
      return;
    }
    const outgoing = active ? creature : game.team.find((item) => item.id === selected)!;
    const incoming = active ? reserves.find((item) => item.id === selected)! : creature;
    const oldDefinitions = CARDS.filter((card) => card.species === outgoing.species);
    const newDefinitions = CARDS.filter((card) => card.species === incoming.species);
    setGame({
      ...game,
      revision: game.revision + 1,
      team: game.team.map((item) => (item.id === outgoing.id ? incoming : item)),
      cards: game.cards.map((card) =>
        card.ownerId === outgoing.id
          ? {
              ...card,
              ownerId: incoming.id,
              definitionId:
                newDefinitions[oldDefinitions.findIndex((definition) => definition.id === card.definitionId)]!
                  .id,
            }
          : card,
      ),
    });
    setReserves(reserves.map((item) => (item.id === incoming.id ? outgoing : item)));
    setAnnouncement(`${species(incoming.species).name} replaced ${species(outgoing.species).name}.`);
    setOpen(false);
    setSelected(null);
  };
  const tile = (creature: Creature, active: boolean) => (
    <div key={creature.id} className={!active && creature.health === 0 ? "knocked-out" : ""}>
      <CreatureCard
        kind={creature.species}
        actorId={creature.id}
        health={creature.health}
        maxHealth={species(creature.species).health}
        block={creature.block}
        selected={selected === creature.id}
        disabled={!active && creature.health === 0}
        label={`${species(creature.species).name}, ${active ? "deployed" : "reserve"}`}
        onClick={() => choose(creature, active)}
      />
    </div>
  );
  return (
    <TooltipProvider delayDuration={300} disableHoverableContent>
      <div className="app swap-sample" data-input="pointer">
        <Dialog
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            setSelected(null);
          }}
        >
          <BattleScreen
            key={game.revision}
            game={game}
            send={() => false}
            controls={controls}
            bursts={[]}
            controller={false}
            navigateFocus={false}
            onDenied={() => {}}
            actions={
              <DialogTrigger asChild>
                <Button variant="outline" className="swap-trigger">
                  <ArrowLeftRight aria-hidden="true" />
                  Swap
                </Button>
              </DialogTrigger>
            }
          />
          <DialogContent className="swap-dialog" closeLabel="Close Swap">
            <DialogTitle>Swap</DialogTitle>
            <DialogDescription className="sr-only">
              Select a deployed creature and a reserve in either order. The swap is free and completes on the
              second selection.
            </DialogDescription>
            <section aria-labelledby="deployed-label">
              <h2 id="deployed-label">Deployed</h2>
              <div className="swap-roster">{game.team.map((creature) => tile(creature, true))}</div>
            </section>
            <section aria-labelledby="reserves-label">
              <h2 id="reserves-label">Reserves</h2>
              <div className="swap-roster swap-reserves">
                {reserves.map((creature) => tile(creature, false))}
              </div>
            </section>
          </DialogContent>
        </Dialog>
        <span className="sr-only" role="status">
          {announcement}
        </span>
      </div>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
