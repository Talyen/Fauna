import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "../../src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../../src/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/components/ui/tooltip";
import { KeywordText } from "../../src/ui/keyword-text";
import { GLOSSARY } from "../../src/game/glossary";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "../button-interactions/study.css";
import "./study.css";

const examples = ["Deal 8 Poison damage. Gain 4 Block.", "Restore Health and gain Mana."];
function KeywordPreview() {
  useEffect(() => {
    const keyboard = () => {
      document.documentElement.dataset.focus = "visible";
    };
    const pointer = () => {
      document.documentElement.dataset.focus = "hidden";
    };
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", pointer, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", pointer, true);
      delete document.documentElement.dataset.focus;
    };
  }, []);
  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <main className="button-study keyword-preview">
        <header className="study-heading">
          <h1>Keywords in rule text</h1>
          <p>Bold, keyword-colored words with normal spacing. Definitions live in the Glossary.</p>
        </header>
        <section className="keyword-example" aria-label="Inline rule examples">
          <h2>Inline text</h2>
          {examples.map((text) => (
            <p key={text}>
              <KeywordText text={text} />
            </p>
          ))}
          <p className="study-instructions">
            Illustrative rules for checking text spacing. Keywords are plain text, with no hover or click
            behavior.
          </p>
        </section>
        <section className="keyword-example" aria-label="Rules inside a parent tooltip">
          <h2>Inside a rules tooltip</h2>
          <Tooltip>
            <TooltipTrigger asChild reopenOnPointerMove={false}>
              <Button variant="outline">Hover or focus for sample rules</Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className="keyword-preview-tooltip">
              <p>
                <KeywordText text={examples[0]!} />
              </p>
            </TooltipContent>
          </Tooltip>
          <p className="study-instructions">
            The surrounding control owns the tooltip. Keywords inside it remain ordinary inline words.
          </p>
        </section>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Glossary</Button>
          </DialogTrigger>
          <DialogContent className="keyword-glossary">
            <DialogTitle>Glossary</DialogTitle>
            <DialogDescription>Definitions from Fauna’s keyword and gameplay catalogs.</DialogDescription>
            <dl>
              {GLOSSARY.map((entry) => (
                <div key={entry.term}>
                  <dt>{entry.term}</dt>
                  <dd>{entry.definition}</dd>
                </div>
              ))}
            </dl>
          </DialogContent>
        </Dialog>
        <footer>
          <p>
            The previous underline, hover and nested-detail comparisons have been retired. Existing stored
            study choices are preserved but no longer used.
          </p>
          <p>
            <a href="/design/talent-interactions/index.html">Continue to talent states</a>
          </p>
        </footer>
      </main>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<KeywordPreview />);
