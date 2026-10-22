import { assetUrl } from "../../src/ui/shared/assets";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../src/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import { Switch } from "../../src/components/ui/switch";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { ArtCard } from "../../src/ui/shared/art-card";
import { ActionCard } from "../../src/ui/shared/cards";
import { ActionDetails } from "../../src/ui/shared/card-details";
import { connectInput, moveFocus, type InputAction } from "../../src/ui/shared/input";
import { CARDS, species } from "../../src/game/content";
import type { Card, Creature } from "../../src/game/types";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "./inspection.css";

const creature = species("emberback");
const actor: Creature = { id: "sample-fox", species: creature.id, health: 12, block: 5, attacked: false };
const cards: Card[] = CARDS.filter((card) => card.species === creature.id).map((card) => ({
  id: `inspection-${card.id}`,
  definitionId: card.id,
  ownerId: actor.id,
  level: 0,
}));
const params = new URLSearchParams(location.search);

function Preview() {
  const [layout, setLayout] = useState(params.get("layout") === "side" ? "side" : "stacked");
  const [enemy, setEnemy] = useState(params.has("enemy"));
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const thumbnails = useRef<HTMLDivElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const previousCard = useRef<number | null>(null);
  const restoreThumbnail = useRef<number | null>(null);
  const cycle = (direction: number) =>
    setSelected((old) => (old === null ? null : (old + direction + cards.length) % cards.length));
  const back = () => {
    if (selected !== null) {
      restoreThumbnail.current = selected;
      setSelected(null);
    } else setOpen(false);
  };
  useLayoutEffect(() => {
    if (selected !== null && previousCard.current === null) backButton.current?.focus();
    previousCard.current = selected;
    if (selected === null && restoreThumbnail.current !== null) {
      thumbnails.current?.querySelectorAll<HTMLButtonElement>("button")[restoreThumbnail.current]?.focus();
      restoreThumbnail.current = null;
    }
  }, [selected]);
  const action = useRef<(action: InputAction) => void>(() => {});
  useLayoutEffect(() => {
    action.current = (input) => {
      if (!open) return;
      if (input === "back") back();
      else if (selected !== null && (input === "left" || input === "right")) cycle(input === "left" ? -1 : 1);
      else if (["left", "right", "up", "down"].includes(input))
        moveFocus(input as "left" | "right" | "up" | "down");
      else if (input === "confirm") (document.activeElement as HTMLElement | null)?.click();
    };
  });
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.input;
    root.dataset.input = "pointer";
    const disconnect = connectInput(
      (input) => action.current(input),
      (mode) => {
        root.dataset.input = mode;
      },
    );
    return () => {
      disconnect();
      if (previous === undefined) delete root.dataset.input;
      else root.dataset.input = previous;
    };
  }, []);
  const card = selected === null ? null : cards[selected]!;
  return (
    <TooltipProvider delayDuration={300} disableHoverableContent>
      <main className="app inspection-sample-launcher">
        <Button
          variant="outline"
          onClick={() => {
            setSelected(null);
            setOpen(true);
          }}
        >
          Open inspection
        </Button>
      </main>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`inspection-review inspection-review-${card ? "action" : layout}`}>
          {card ? (
            <>
              <header className="inspection-action-header">
                <Button ref={backButton} variant="ghost" onClick={back}>
                  <ChevronLeft aria-hidden="true" />
                  Back
                </Button>
              </header>
              <DialogTitle className="sr-only">Action inspection</DialogTitle>
              <DialogDescription className="sr-only">
                Use Previous/Next, A/D, or controller left/right to compare actions. Back returns to the
                creature.
              </DialogDescription>
              <div className="inspection-enlarged">
                <ActionCard
                  card={card}
                  actor={actor}
                  ownerName={creature.name}
                  presentation
                  onClick={() => {}}
                />
                <ActionDetails card={card} actor={actor} ownerName={creature.name} />
              </div>
              <nav className="inspection-action-navigation" aria-label="Action cards">
                <Button variant="ghost" size="icon" aria-label="Previous action" onClick={() => cycle(-1)}>
                  <ChevronLeft />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Next action" onClick={() => cycle(1)}>
                  <ChevronRight />
                </Button>
              </nav>
            </>
          ) : (
            <>
              <div className="inspection-comparison-controls">
                <Tabs value={layout} onValueChange={setLayout}>
                  <TabsList aria-label="Inspection layout">
                    <TabsTrigger value="stacked">A · Stacked</TabsTrigger>
                    <TabsTrigger value="side">B · Side-by-side</TabsTrigger>
                  </TabsList>
                </Tabs>
                <label className="inspection-enemy-toggle" htmlFor="enemy-inspection">
                  Enemy
                  <Switch id="enemy-inspection" checked={enemy} onCheckedChange={setEnemy} />
                </label>
              </div>
              <DialogTitle>{creature.name}</DialogTitle>
              <DialogDescription className="sr-only">
                Creature artwork, current health and effects, passive, and three action cards.
              </DialogDescription>
              <div className="inspection-review-composition">
                <ArtCard
                  aspect="creature"
                  artwork={assetUrl("creature.emberback")}
                  presentation
                  aria-label="Emberback artwork"
                />
                <div className="inspection-review-kit">
                  <p className="inspection-review-health">
                    {enemy ? "15 / 22 health" : "12 / 24 health · 5 Block"}
                  </p>
                  {enemy ? <h2 className="inspection-kit-label">Species kit</h2> : null}
                  <div className="inspection-review-passive">
                    <strong>{creature.trait}</strong>
                    <p>{creature.passiveTiers[0].description}</p>
                  </div>
                  <div className="inspection-action-thumbnails" ref={thumbnails}>
                    {cards.map((item, index) => (
                      <ActionCard
                        key={item.id}
                        card={item}
                        actor={actor}
                        ownerName={creature.name}
                        onClick={() => setSelected(index)}
                        onInspect={() => setSelected(index)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
