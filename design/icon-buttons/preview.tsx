import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, ChevronLeft, ChevronRight, LoaderCircle, Menu, X } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import { Switch } from "../../src/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "../../src/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/components/ui/tooltip";
import { reviewedButtonChoices } from "../button-interactions/reviewed-choices";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "../button-interactions/study.css";
import "./study.css";

const icons = { Menu, Back: ArrowLeft, Close: X, Previous: ChevronLeft, Next: ChevronRight };
type IconName = keyof typeof icons;
const hitAreaStep = new URLSearchParams(window.location.search).get("step") === "hit-area";
const reviewedIconSize = "20";
const storageKey = hitAreaStep ? "fauna-design-icon-hit-area-v1" : "fauna-design-icon-size-v1";
const sizes = hitAreaStep ? ["44", "48", "52"] : ["16", "20", "24"];
function initialSize() {
  try {
    const value = localStorage.getItem(storageKey) ?? "";
    return sizes.includes(value) ? value : "";
  } catch {
    return "";
  }
}
function IconSample({
  size,
  targetSize,
  icon,
  unavailable,
  busyAction,
}: {
  size: string;
  targetSize: string;
  icon: IconName;
  unavailable: boolean;
  busyAction: boolean;
}) {
  const [count, setCount] = useState(0);
  const [held, setHeld] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const Icon = icons[icon];
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      setWaiting(false);
      setCount((value) => value + 1);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  const attributes = Object.fromEntries(
    Object.entries(reviewedButtonChoices).map(([key, value]) => [`data-${key}`, value]),
  );
  return (
    <div
      className="study-demo"
      {...attributes}
      data-role="supporting"
      data-icon-size={size}
      data-hit-area={targetSize}
      data-unavailable={unavailable ? reviewedButtonChoices.unavailable : undefined}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="study-action"
            aria-label={`${icon}, ${size}px icon, ${targetSize}px target`}
            aria-busy={waiting}
            disabled={unavailable || waiting}
            data-held={held || undefined}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") setHeld(true);
            }}
            onKeyUp={() => setHeld(false)}
            onBlur={() => setHeld(false)}
            onClick={() => (busyAction ? setWaiting(true) : setCount((value) => value + 1))}
          >
            {waiting ? (
              <LoaderCircle className="study-spinner" aria-hidden="true" />
            ) : (
              <Icon aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{icon}</TooltipContent>
      </Tooltip>
      <output aria-live="polite">{waiting ? "Working…" : `Actions accepted: ${count}`}</output>
    </div>
  );
}
function IconStudy() {
  const [icon, setIcon] = useState<IconName>("Menu");
  const [choice, setChoice] = useState(initialSize);
  const [unavailable, setUnavailable] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, choice);
      // eslint-disable-next-line react/set-state-in-effect -- This prototype reports the result of writing to external browser storage
      setStorageFailed(false);
    } catch {
      // eslint-disable-next-line react/set-state-in-effect -- Failed external storage writes must remain visible in the prototype
      setStorageFailed(true);
    }
  }, [choice]);
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
    <TooltipProvider>
      <main className="button-study icon-study" data-reduced={reduced}>
        <header className="study-heading">
          <h1>{hitAreaStep ? "Icon buttons · 2. Hit area" : "Icon buttons · 1. Icon size"}</h1>
          <p>
            {hitAreaStep
              ? "Your chosen 20px icon stays fixed. Only the square button’s hit area varies; its visible boundary is its clickable boundary."
              : "Only icon size varies. Every option has the same 44 × 44px hit area and your chosen button interactions."}
          </p>
        </header>
        <RadioGroup
          value={icon}
          onValueChange={(value) => setIcon(value as IconName)}
          aria-label="Preview icon"
          className="study-controls"
        >
          {Object.keys(icons).map((name) => (
            <label key={name}>
              <RadioGroupItem value={name} />
              {name}
            </label>
          ))}
        </RadioGroup>
        <p className="study-instructions">
          Hover, hold a click, and use Tab / Space / Enter. Try each symbol before choosing. The label appears
          in a tooltip; it is always available to assistive technology.
        </p>
        <RadioGroup
          value={choice}
          onValueChange={setChoice}
          aria-label={hitAreaStep ? "Choose hit area" : "Choose icon size"}
          className="study-grid"
        >
          {sizes.map((size, index) => (
            <section className="study-sample" key={size}>
              <h2>
                {String.fromCharCode(65 + index)} ·{" "}
                {hitAreaStep ? `${size} × ${size}px target` : `${size}px icon`}
              </h2>
              <IconSample
                key={`${size}-${icon}`}
                size={hitAreaStep ? reviewedIconSize : size}
                targetSize={hitAreaStep ? size : "44"}
                icon={icon}
                unavailable={unavailable}
                busyAction={busyAction}
              />
              <label className="study-choice">
                <RadioGroupItem value={size} />
                Choose {size}px
              </label>
            </section>
          ))}
        </RadioGroup>
        <p className="study-recommendation">
          {hitAreaStep
            ? "My recommendation: 44px, matching Fauna’s existing control height. 48px is more forgiving; 52px is roomiest but occupies more space. Try clicking near the edges. Sizes are measured at rest; your hover growth still applies."
            : "My recommendation: 20px. It is more legible than 16px while leaving more breathing room than 24px."}
          Your choice: {choice ? `${choice}px` : "Undecided"}.
        </p>
        <Button variant="outline" disabled={!choice} onClick={() => setChoice("")}>
          Clear this choice
        </Button>
        <div className="study-controls">
          <label>
            <Switch checked={unavailable} onCheckedChange={setUnavailable} />
            Preview unavailable
          </label>
          <label>
            <Switch checked={busyAction} onCheckedChange={setBusyAction} />
            Preview busy action
          </label>
          <label>
            <Switch checked={reduced} onCheckedChange={setReduced} />
            Reduce motion
          </label>
        </div>
        {storageFailed ? (
          <p role="status">Browser storage is unavailable. Your choice remains for this visit only.</p>
        ) : null}
        <footer>
          <p>
            Your baseline: subtle fills, gold hover/press borders, 3.5% hover/focus growth, solid focus
            outline, 2% pressed shrink, 150ms, 50% unavailable contrast.
          </p>
          <p>
            Busy keeps the spinner inside and “Working…” outside the square button. There is no selected
            state: these buttons issue commands.
          </p>
          <p>
            Next: {hitAreaStep ? "the tooltip review batch" : "hit area"}, then a combined in-context review.
            No game UI or game saves change. Mouse/keyboard only; controller review is pending.
          </p>
          <Button variant="outline" asChild>
            <a
              href={
                hitAreaStep
                  ? "/design/icon-buttons/index.html"
                  : "/design/icon-buttons/index.html?step=hit-area"
              }
            >
              {hitAreaStep ? "Review icon size" : "Next: hit area"}
            </a>
          </Button>
          {hitAreaStep ? (
            <Button asChild>
              <a href="/design/tooltip-interactions/index.html">Next: tooltip review batch</a>
            </Button>
          ) : null}
        </footer>
      </main>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<IconStudy />);
