import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, type ButtonProps } from "../../src/components/ui/button";
import { Switch } from "../../src/components/ui/switch";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "./study.css";

const options = [
  {
    id: "current",
    title: "Current",
    detail: "Slight enlargement on hover and focus. No separate pressed style.",
  },
  {
    id: "neutral",
    title: "A · Neutral",
    detail: "Stable size. Neutral hover, dashed gold focus, darker press.",
  },
  {
    id: "gold",
    title: "B · Gold edge",
    detail: "Stable size. Gold hover border, dashed gold focus, darker press.",
  },
] as const;

function StudyAction({ children, ...props }: ButtonProps) {
  const [held, setHeld] = useState(false);
  return (
    <Button
      {...props}
      className="study-action"
      data-held={held || undefined}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") setHeld(true);
      }}
      onKeyUp={() => setHeld(false)}
      onBlur={() => setHeld(false)}
    >
      {children}
    </Button>
  );
}

function Sample({ option, unavailable }: { option: (typeof options)[number]; unavailable: boolean }) {
  const [count, setCount] = useState(0);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      setWaiting(false);
      setCount((value) => value + 1);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  return (
    <section className="study-sample" data-treatment={option.id} aria-labelledby={`${option.id}-title`}>
      <header>
        <h2 id={`${option.id}-title`}>{option.title}</h2>
        <p>{option.detail}</p>
      </header>
      <div className="study-actions">
        <StudyAction disabled={unavailable} onClick={() => setCount((value) => value + 1)}>
          Begin battle
        </StudyAction>
        <StudyAction variant="outline" disabled={unavailable} onClick={() => setCount((value) => value + 1)}>
          Deck
        </StudyAction>
        <StudyAction variant="outline" disabled={unavailable} onClick={() => setCount((value) => value + 1)}>
          Back
        </StudyAction>
        <StudyAction
          variant="outline"
          disabled={unavailable || waiting}
          aria-busy={waiting}
          onClick={() => setWaiting(true)}
        >
          {waiting ? "Working…" : "Try waiting"}
        </StudyAction>
      </div>
      <output aria-live="polite">Actions accepted: {count}</output>
    </section>
  );
}

function ButtonStudy() {
  const [unavailable, setUnavailable] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (["Tab", "Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key))
        document.documentElement.dataset.focus = "visible";
    };
    const pointer = () => {
      document.documentElement.dataset.focus = "hidden";
    };
    document.documentElement.dataset.focus = "hidden";
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("pointermove", pointer, true);
    document.addEventListener("wheel", pointer, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("pointermove", pointer, true);
      document.removeEventListener("wheel", pointer, true);
      delete document.documentElement.dataset.focus;
    };
  }, []);
  return (
    <main className="button-study" data-reduced={reduced}>
      <header className="study-heading">
        <h1>Button interactions</h1>
        <p>Interactive design study · actual Fauna shadcn/ui components · no game saves</p>
      </header>
      <div className="study-controls" aria-label="Comparison settings">
        <label>
          <Switch checked={unavailable} onCheckedChange={setUnavailable} />
          Unavailable actions
        </label>
        <label>
          <Switch checked={reduced} onCheckedChange={setReduced} />
          Reduce motion
        </label>
      </div>
      <p className="study-instructions">
        Hover and hold a click to feel the press. Use Tab or Shift+Tab for focus, Space or Enter to activate.
        “Try waiting” demonstrates a brief busy state. Each column counts its accepted actions.
      </p>
      <div className="study-grid">
        {options.map((option) => (
          <Sample key={option.id} option={option} unavailable={unavailable} />
        ))}
      </div>
      <footer>
        <p>
          A is the quieter recommendation; B makes the hovered outline more prominent. Both keep the same 44px
          control height.
        </p>
        <p>Gold fill identifies the main action. The dashed external outline identifies keyboard focus.</p>
        <p>This study exercises mouse and native keyboard behavior. Gamepad navigation is not connected.</p>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ButtonStudy />);
