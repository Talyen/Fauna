import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "../../src/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../src/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/components/ui/tooltip";
import { ArtCard } from "../../src/ui/art-card";
import { CreatureDetails, ActionDetails } from "../../src/ui/card-details";
import { CARDS, ENCOUNTERS, species, type SpeciesId } from "../../src/game/content";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "./selection.css";

type Slot = { row: "active" | "reserve"; index: number };
function TeamSelection() {
  const [roster, setRoster] = useState<Record<Slot["row"], SpeciesId[]>>({
    active: ["mossback", "emberfox", "stormfin"],
    reserve: ["silkmoth", "briartooth", "moonhart"],
  });
  const [selected, setSelected] = useState<Slot | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);
  const [inspection, setInspection] = useState<SpeciesId | null>(null);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const board = useRef<HTMLElement>(null);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (deckOpen || inspection) return;
      const current = document.activeElement as HTMLElement | null;
      const row = Number(current?.dataset.row);
      const column = Number(current?.dataset.column);
      const key = event.key.toLowerCase();
      if (key === "escape") {
        setSelected(null);
        return;
      }
      if (key === "i" && current?.dataset.kind) {
        event.preventDefault();
        setInspection(current.dataset.kind as SpeciesId);
        return;
      }
      if (!["a", "d", "w", "s"].includes(key) || !Number.isInteger(row) || !Number.isInteger(column)) return;
      event.preventDefault();
      const nextRow = key === "w" ? (row + 2) % 3 : key === "s" ? (row + 1) % 3 : row;
      const nextColumn = key === "a" ? (column + 2) % 3 : key === "d" ? (column + 1) % 3 : column;
      board.current
        ?.querySelector<HTMLButtonElement>(`[data-row="${nextRow}"][data-column="${nextColumn}"]`)
        ?.focus();
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [deckOpen, inspection]);
  const choose = (slot: Slot) => {
    if (ready) return;
    if (!selected || selected.row === slot.row) {
      setSelected(selected?.row === slot.row && selected.index === slot.index ? null : slot);
      return;
    }
    const incoming = roster[slot.row][slot.index]!;
    const outgoing = roster[selected.row][selected.index]!;
    const next = { active: [...roster.active], reserve: [...roster.reserve] };
    next[selected.row][selected.index] = incoming;
    next[slot.row][slot.index] = outgoing;
    setRoster(next);
    setSelected(null);
    setAnnouncement(`Swapped ${species(incoming).name} and ${species(outgoing).name}.`);
  };
  const tile = (kind: SpeciesId, row: number, column: number, slot?: Slot, name?: string) => (
    <Tooltip key={`${row}-${column}`}>
      <TooltipTrigger asChild>
        <ArtCard
          aspect="creature"
          artwork={`/art/${kind}.svg`}
          data-row={row}
          data-column={column}
          data-kind={kind}
          aria-label={name ?? `${species(kind).name}, ${slot?.row}`}
          aria-pressed={slot ? selected?.row === slot.row && selected.index === slot.index : undefined}
          className={
            slot && selected?.row === slot.row && selected.index === slot.index ? "team-picked" : undefined
          }
          onClick={() => (slot ? choose(slot) : setInspection(kind))}
          onContextMenu={(event) => {
            event.preventDefault();
            event.currentTarget.focus();
            setInspection(kind);
          }}
        />
      </TooltipTrigger>
      <TooltipContent>
        <CreatureDetails kind={kind} name={name} />
      </TooltipContent>
    </Tooltip>
  );
  return (
    <main className="team-sample" ref={board}>
      <section className="team-row" aria-label="Enemy lineup">
        {ENCOUNTERS[1].enemies.map((enemy, index) => tile(enemy.species, 0, index, undefined, enemy.name))}
      </section>
      <section className="team-roster-group" aria-labelledby="active-label">
        <h2 id="active-label">Active</h2>
        <div className="team-row">
          {roster.active.map((kind, index) => tile(kind, 1, index, { row: "active", index }))}
        </div>
      </section>
      <section className="team-roster-group" aria-labelledby="reserve-label">
        <h2 id="reserve-label">Reserves</h2>
        <div className="team-row team-reserve-row">
          {roster.reserve.map((kind, index) => tile(kind, 2, index, { row: "reserve", index }))}
        </div>
      </section>
      <footer className="team-footer">
        <Button variant="outline" onClick={() => setDeckOpen(true)}>
          Deck
        </Button>
        <Button
          disabled={ready}
          onClick={() => {
            setReady(true);
            setSelected(null);
            setAnnouncement("Team ready. Selection sample complete.");
          }}
        >
          {ready ? "Team ready" : "Begin battle"}
        </Button>
      </footer>
      <span className="sr-only" role="status">
        {announcement}
      </span>
      <Dialog open={deckOpen} onOpenChange={setDeckOpen}>
        <DialogContent className="team-deck" closeLabel="Close deck">
          <DialogTitle>Deck</DialogTitle>
          <DialogDescription className="sr-only">
            Nine cards contributed by the active team.
          </DialogDescription>
          <div className="team-deck-grid">
            {roster.active.flatMap((kind) =>
              CARDS.filter((card) => card.species === kind).map((def) => (
                <Tooltip key={def.id}>
                  <TooltipTrigger asChild>
                    <ArtCard aspect="action" artwork={`/art/${kind}-action.svg`} aria-label={def.name} />
                  </TooltipTrigger>
                  <TooltipContent>
                    <ActionDetails
                      card={{ id: def.id, definitionId: def.id, ownerId: kind, level: 0 }}
                      ownerName={species(kind).name}
                    />
                  </TooltipContent>
                </Tooltip>
              )),
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={inspection !== null}
        onOpenChange={(open) => {
          if (!open) setInspection(null);
        }}
      >
        <DialogContent className="team-inspection">
          <DialogTitle className="sr-only">Creature details</DialogTitle>
          <DialogDescription className="sr-only">Creature artwork and rules</DialogDescription>
          {inspection ? (
            <>
              <ArtCard
                aspect="creature"
                artwork={`/art/${inspection}.svg`}
                presentation
                aria-label={species(inspection).name}
              />
              <CreatureDetails kind={inspection} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <TooltipProvider delayDuration={300}>
    <TeamSelection />
  </TooltipProvider>,
);
