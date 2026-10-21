import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "../../src/components/ui/button";
import { RadioGroup, RadioGroupItem } from "../../src/components/ui/radio-group";
import { Switch } from "../../src/components/ui/switch";
import { ArtCard } from "../../src/ui/art-card";
import { assetUrl } from "../../src/ui/assets";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "../button-interactions/study.css";
import "./study.css";

const options = ["16", "32", "48"] as const;
const creatures = [
  { id: "mossguard", name: "Mossguard" },
  { id: "emberback", name: "Emberback" },
] as const;
const storageKey = "fauna-design-swap-arc-v1";
function loadChoice(): string {
  try {
    const value = localStorage.getItem(storageKey);
    return options.some((option) => option === value) ? value! : "";
  } catch {
    return "";
  }
}
function SwapStudy() {
  const [choice, setChoice] = useState(loadChoice);
  const [arc, setArc] = useState(choice || "32");
  const [swapped, setSwapped] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [storageFailed, setStorageFailed] = useState(false);
  const [copyState, setCopyState] = useState("");
  const elements = useRef<(HTMLDivElement | null)[]>([]);
  const flights = useRef<Animation[]>([]);
  const pending = useRef<DOMRect[] | null>(null);
  const noMotion = reduced || systemReduced;
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setSystemReduced(query.matches);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    try {
      if (choice) localStorage.setItem(storageKey, choice);
      else localStorage.removeItem(storageKey);
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
    setCopyState("");
  }, [choice]);
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
      flights.current.forEach((flight) => flight.cancel());
    };
  }, []);
  useLayoutEffect(() => {
    flights.current.forEach((flight) => flight.cancel());
    flights.current = [];
    const before = pending.current;
    pending.current = null;
    if (!before || noMotion) return;
    const after = elements.current.map((element) => element?.getBoundingClientRect());
    elements.current.forEach((element, index) => {
      const from = before[index],
        to = after[index];
      if (!element || !from || !to) return;
      const dx = from.left - to.left,
        dy = from.top - to.top;
      const height = Number(arc) * (index === 0 ? -1 : 1);
      const frames = Array.from({ length: 61 }, (_, frame) => {
        const t = frame / 60,
          p = 1 - (1 - t) ** 3;
        const bend = t === 0 || t === 1 ? 0 : Math.sin(Math.PI * p) ** 2 * height;
        return { offset: t, transform: `translate(${dx * (1 - p)}px, ${dy * (1 - p) + bend}px)` };
      });
      flights.current.push(element.animate(frames, { duration: slow ? 600 : 150, easing: "linear" }));
    });
  }, [swapped, arc, noMotion, slow]);
  const swap = () => {
    pending.current = elements.current
      .map((element) => element?.getBoundingClientRect())
      .filter((rect): rect is DOMRect => !!rect);
    setSwapped((value) => !value);
    setSelected(null);
  };
  async function copyChoice() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ study: "swap-motion", choices: { arcHeight: choice } }, null, 2),
      );
      setCopyState("Copied choice");
    } catch {
      setCopyState("Could not copy. Your choice remains visible below.");
    }
  }
  return (
    <main className="button-study swap-study" data-reduced={noMotion}>
      <header className="study-heading">
        <h1>Swap · opposing arc height</h1>
        <p>One remaining motion detail. Preview each height in the same scene, then save your preference.</p>
      </header>
      <RadioGroup
        value={arc}
        onValueChange={setArc}
        aria-label="Preview arc height"
        className="study-role arc-options"
      >
        {options.map((value, index) => (
          <label key={value}>
            <RadioGroupItem value={value} />
            {String.fromCharCode(65 + index)} · {value}px
          </label>
        ))}
      </RadioGroup>
      <div className="study-controls">
        <label>
          <Switch checked={slow} onCheckedChange={setSlow} />
          Slow motion · 4× for inspection
        </label>
        <label>
          <Switch checked={reduced} onCheckedChange={setReduced} />
          Reduce motion
        </label>
      </div>
      <div className="swap-scroll">
        <section className="swap-stage" aria-label="Swap preview" data-swapped={swapped}>
          {creatures.map((creature, index) => (
            <div
              className="swap-flight"
              key={creature.id}
              data-creature={creature.id}
              ref={(element) => {
                elements.current[index] = element;
              }}
            >
              <ArtCard
                aspect="creature"
                artwork={assetUrl(`creature.${creature.id}`)}
                aria-label={`${creature.name}, ${selected === creature.id ? "selected" : "select for Swap"}`}
                aria-pressed={selected === creature.id}
                className="swap-art"
                onClick={() =>
                  selected && selected !== creature.id
                    ? swap()
                    : setSelected((value) => (value === creature.id ? null : creature.id))
                }
              />
              <p>{creature.name}</p>
            </div>
          ))}
        </section>
      </div>
      <p role="status" className="study-instructions">
        Left slot: {swapped ? "Emberback" : "Mossguard"}. Right slot: {swapped ? "Mossguard" : "Emberback"}.{" "}
        {selected
          ? "Choose the other creature to swap, or the same creature to cancel."
          : "Select a creature, then the other—or use Swap again."}
      </p>
      <div className="study-navigation">
        <Button onClick={swap}>Swap again</Button>
        <Button variant="outline" onClick={() => setChoice(arc)}>
          Choose {arc}px arcs
        </Button>
        <Button variant="outline" disabled={!choice} onClick={() => setChoice("")}>
          Clear choice
        </Button>
        <Button variant="outline" disabled={!choice} onClick={() => void copyChoice()}>
          Copy choice
        </Button>
      </div>
      <p className="study-recommendation">
        Recommendation: 32px. Enough curvature to read both paths while keeping travel compact. Your saved
        choice: {choice ? `${choice}px` : "Undecided"}. Previewing a height does not save it.
      </p>
      {storageFailed ? <p role="status">Storage unavailable; your choice remains for this visit.</p> : null}
      {copyState ? <p role="status">{copyState}</p> : null}
      <footer>
        <p>
          Already chosen: 4px selection lift over 150ms, unchanged single ring on selected hover, opposing
          arcs and ease-out travel over 150ms. Slow motion is only an inspection aid. Artwork stays at fixed
          dimensions.
        </p>
        <p>
          Swaps commit immediately in this local simulation. Input remains available during motion; repeated
          swaps retarget from the visible position. Reduced motion cancels flights. No game saves or
          production Swap behavior change.
        </p>
        <p>
          <a href="/design/talent-interactions/index.html">Talent states</a>
        </p>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<SwapStudy />);
