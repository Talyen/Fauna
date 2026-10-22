import { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, ChevronLeft, Star } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../src/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { ActionCard, CreatureCard } from "../../src/ui/shared/cards/cards";
import { KeywordText } from "../../src/ui/shared/keyword-text";
import { CARDS, species } from "../../src/game/content";
import type { Card } from "../../src/game/types";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "./study.css";

const params = new URLSearchParams(location.search);
const option = ["a", "b", "c"].includes(params.get("option") ?? "") ? params.get("option")! : "a";
const creature = species("mossguard");
const rank = 2;
const progression = { discovery: { encountered: [creature.id], recruited: { [creature.id]: rank + 1 } } };
const cards: Card[] = CARDS.filter((card) => card.species === creature.id).map((card) => ({
  id: `study-${card.id}`,
  definitionId: card.id,
  ownerId: creature.id,
  level: 0,
}));

function Study() {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [tier, setTier] = useState(String(rank));
  const backButton = useRef<HTMLButtonElement>(null);
  const thumbnails = useRef<HTMLDivElement>(null);
  const restore = useRef<number | null>(null);
  const card = selected === null ? null : cards[selected]!;
  const back = () => {
    if (selected !== null) {
      restore.current = selected;
      setSelected(null);
    } else setOpen(false);
  };
  useLayoutEffect(() => {
    document.documentElement.dataset.input = "pointer";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") document.documentElement.dataset.focus = "visible";
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useLayoutEffect(() => {
    if (selected !== null) backButton.current?.focus();
    else if (restore.current !== null) {
      thumbnails.current?.querySelectorAll<HTMLButtonElement>("button")[restore.current]?.focus();
      restore.current = null;
    }
  }, [selected]);
  return (
    <TooltipProvider>
      <main className="inspection-study-launcher">
        <Button onClick={() => setOpen(true)}>Open inspection</Button>
      </main>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={`inspection-study option-${option}${card ? " study-action" : ""}`}
          onEscapeKeyDown={(event) => {
            if (selected !== null) {
              event.preventDefault();
              back();
            }
          }}
        >
          <header className="study-back">
            <Button ref={backButton} size="icon" variant="ghost" aria-label="Back" onClick={back}>
              <ChevronLeft aria-hidden="true" />
            </Button>
          </header>
          <DialogTitle className="sr-only">Mossguard inspection</DialogTitle>
          <DialogDescription className="sr-only">
            Creature and ability artwork, with visible passive rank progression
          </DialogDescription>
          {card ? (
            <ActionCard card={card} ownerName={creature.name} onClick={() => {}} />
          ) : (
            <>
              <div className="study-artwork">
                <CreatureCard kind={creature.id} progression={progression} readout={false} speciesKit />
                <div className="study-abilities" aria-label="Abilities" ref={thumbnails}>
                  {cards.map((action, index) => (
                    <ActionCard
                      key={action.id}
                      card={action}
                      ownerName={creature.name}
                      onClick={() => setSelected(index)}
                    />
                  ))}
                </div>
              </div>
              <section className="study-passive" aria-label="Passive ranks">
                <h2>{creature.trait}</h2>
                {option === "a" ? (
                  <ol className="study-rank-list">
                    {creature.passiveTiers.map((passive, index) => (
                      <li key={index} aria-current={index === rank ? "step" : undefined}>
                        <span className="study-rank">
                          <span>{index}</span>
                          <Star aria-label="stars" />
                        </span>
                        <p>
                          <KeywordText text={passive.description} />
                        </p>
                        {index === rank ? (
                          <Check className="study-current" aria-label="Current rank" />
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : option === "b" ? (
                  <Tabs value={tier} onValueChange={setTier}>
                    <TabsList aria-label="Passive rank">
                      {creature.passiveTiers.map((_, index) => (
                        <TabsTrigger
                          key={index}
                          value={String(index)}
                          aria-label={`${index} stars${index === rank ? "; current rank" : ""}`}
                        >
                          {index}
                          <Star aria-hidden="true" />
                          {index === rank ? <Check aria-hidden="true" /> : null}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {creature.passiveTiers.map((passive, index) => (
                      <TabsContent key={index} value={String(index)}>
                        <p>
                          <KeywordText text={passive.description} />
                        </p>
                        <p className="study-rank-status">
                          {index === rank ? "Current rank" : `${index} ${index === 1 ? "star" : "stars"}`}
                        </p>
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  <>
                    <p>
                      <KeywordText text="Retain more Block between turns" />
                    </p>
                    <table className="study-rank-table" aria-label="Block retained by rank">
                      <thead>
                        <tr>
                          {creature.passiveTiers.map((_, index) => (
                            <th key={index} scope="col">
                              <span>{index}</span>
                              <Star aria-label="stars" />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {creature.passiveTiers.map((passive, index) => (
                            <td key={index} aria-current={index === rank ? "step" : undefined}>
                              {passive.effects.find((effect) => effect.kind === "blockRetention")?.amount}%
                              {index === rank ? <Check aria-label="Current rank" /> : null}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}
              </section>
              <footer className="study-actions">
                <Button onClick={() => setOpen(false)}>Choose Mossguard</Button>
              </footer>
            </>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Study />);
