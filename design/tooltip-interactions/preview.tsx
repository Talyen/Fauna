import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Menu } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import { RadioGroup, RadioGroupItem } from "../../src/components/ui/radio-group";
import { Switch } from "../../src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/components/ui/tooltip";
import { reviewedButtonChoices } from "../button-interactions/reviewed-choices";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "../button-interactions/study.css";
import "../icon-buttons/study.css";
import "./study.css";

const steps = [
  {
    id: "delay",
    title: "Opening delay",
    options: ["0", "150", "350"],
    labels: ["Immediate", "150ms", "350ms"],
    recommendation: "150ms: quick information with fewer accidental popups.",
    instruction:
      "Hover each icon from outside its button. Only the wait before opening changes. Keyboard focus opens immediately in every option.",
  },
  {
    id: "side",
    title: "Placement",
    options: ["top", "bottom", "left", "right"],
    labels: ["Above", "Below", "Left", "Right"],
    recommendation: "Above for this utility button; final placement depends on screen context.",
    instruction:
      "Hover or Tab to each icon. Only the preferred side changes. Collision handling can still flip a tooltip near an edge.",
  },
  {
    id: "gap",
    title: "Distance",
    options: ["8", "12", "16"],
    labels: ["8px", "12px", "16px"],
    recommendation: "12px: clear separation without feeling detached.",
    instruction:
      "Only the gap between button and tooltip changes. Icon, content, preferred side and timing stay fixed.",
  },
  {
    id: "fade",
    title: "Fade duration",
    options: ["0", "100", "150"],
    labels: ["No fade", "100ms", "150ms"],
    recommendation: "100ms: a short fade with no sliding movement.",
    instruction:
      "Only fade-in duration changes. All options wait the same 150ms before opening. Reduced motion removes the fade.",
  },
  {
    id: "border",
    title: "Border contrast",
    options: ["neutral", "lighter", "gold"],
    labels: ["Neutral", "Lighter neutral", "Gold"],
    recommendation: "Neutral: keeps information quieter than controls and focus.",
    instruction: "Only the tooltip border color changes. Hover or use Tab to reveal each example.",
  },
] as const;
type StepId = (typeof steps)[number]["id"];
type Picks = Partial<Record<StepId, string>>;
const storageKey = "fauna-design-tooltip-picks-v1";
const defaults = { delay: "150", side: "top", gap: "12", fade: "0", border: "neutral" };
function loadPicks(): Picks {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    return Object.fromEntries(
      steps.flatMap((step) =>
        (step.options as readonly string[]).includes(saved?.[step.id]) ? [[step.id, saved[step.id]]] : [],
      ),
    );
  } catch {
    return {};
  }
}
function Sample({
  settings,
  label,
  reduced,
}: {
  settings: typeof defaults;
  label: string;
  reduced: boolean;
}) {
  const [count, setCount] = useState(0);
  const [held, setHeld] = useState(false);
  const attributes = Object.fromEntries(
    Object.entries(reviewedButtonChoices).map(([key, value]) => [`data-${key}`, value]),
  );
  return (
    <div
      className="study-demo tooltip-demo"
      {...attributes}
      data-unavailable={undefined}
      data-role="supporting"
      data-icon-size="20"
      data-hit-area="44"
    >
      <TooltipProvider delayDuration={Number(settings.delay)} skipDelayDuration={0}>
        <Tooltip delayDuration={Number(settings.delay)}>
          <TooltipTrigger asChild reopenOnPointerMove={false}>
            <Button
              variant="outline"
              size="icon"
              className="study-action"
              aria-label={`${label}: Menu`}
              data-held={held || undefined}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") setHeld(true);
              }}
              onKeyUp={() => setHeld(false)}
              onBlur={() => setHeld(false)}
              onClick={() => setCount((value) => value + 1)}
            >
              <Menu aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            className="tooltip-review-content"
            side={settings.side as "top" | "bottom" | "left" | "right"}
            sideOffset={Number(settings.gap)}
            data-fade={settings.fade}
            data-border={settings.border}
            data-reduced={reduced}
          >
            Open menu
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <output aria-live="polite">Actions accepted: {count}</output>
    </div>
  );
}
function TooltipStudy() {
  const [stepId, setStepId] = useState("delay");
  const [picks, setPicks] = useState<Picks>(loadPicks);
  const [reduced, setReduced] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const index = steps.findIndex((step) => step.id === stepId);
  const step = steps[index];
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(picks));
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }, [picks]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (["Tab", "Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key))
        document.documentElement.dataset.focus = "visible";
    };
    const pointer = () => {
      document.documentElement.dataset.focus = "hidden";
    };
    document.documentElement.dataset.focus = "hidden";
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("pointermove", pointer, true);
    document.addEventListener("wheel", pointer, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("pointermove", pointer, true);
      document.removeEventListener("wheel", pointer, true);
      delete document.documentElement.dataset.focus;
    };
  }, []);
  return (
    <main className="button-study icon-study" data-reduced={reduced}>
      <header className="study-heading">
        <h1>Tooltip review · keep going at your own pace</h1>
        <p>
          Your 20px icon, 44px hit area and button interactions stay fixed. One tooltip behavior changes per
          step.
        </p>
      </header>
      <Tabs value={stepId} onValueChange={setStepId}>
        <TabsList className="study-tabs" aria-label="Tooltip decisions">
          {steps.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.title}
            </TabsTrigger>
          ))}
          <TabsTrigger value="combined">Review my batch</TabsTrigger>
        </TabsList>
        <TabsContent value={stepId}>
          {step ? (
            <section key={step.id}>
              <h2>
                {index + 1}. {step.title}
              </h2>
              <p className="study-instructions">{step.instruction}</p>
              <RadioGroup
                value={picks[step.id] ?? ""}
                onValueChange={(value) => setPicks((previous) => ({ ...previous, [step.id]: value }))}
                aria-label={`Choose ${step.title.toLowerCase()}`}
                className="study-grid"
              >
                {step.options.map((value, i) => (
                  <section className="study-sample" key={value}>
                    <h3>
                      {String.fromCharCode(65 + i)} · {step.labels[i]}
                    </h3>
                    <Sample
                      settings={{ ...defaults, [step.id]: value }}
                      label={step.labels[i] ?? value}
                      reduced={reduced}
                    />
                    <label className="study-choice">
                      <RadioGroupItem value={value} />
                      Choose {step.labels[i]?.toLowerCase() ?? value}
                    </label>
                  </section>
                ))}
              </RadioGroup>
              <p className="study-recommendation">
                Recommendation: {step.recommendation} Your choice:{" "}
                {picks[step.id]
                  ? step.labels[(step.options as readonly string[]).indexOf(picks[step.id]!)]
                  : "Undecided"}
                .
              </p>
              <nav className="study-navigation" aria-label="Review steps">
                <Button
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => setStepId(steps[index - 1]?.id ?? step.id)}
                >
                  Previous decision
                </Button>
                <Button onClick={() => setStepId(steps[index + 1]?.id ?? "combined")}>
                  {index === steps.length - 1 ? "Review my batch" : "Next decision"}
                </Button>
                <Button
                  variant="outline"
                  disabled={!picks[step.id]}
                  onClick={() =>
                    setPicks((previous) => {
                      const next = { ...previous };
                      delete next[step.id];
                      return next;
                    })
                  }
                >
                  Clear this choice
                </Button>
              </nav>
            </section>
          ) : (
            <section>
              <h2>Your tooltip batch</h2>
              <p className="study-instructions">
                Try your combination below. Undecided values use the stated comparison baseline, not an
                assumed preference.
              </p>
              <Sample settings={{ ...defaults, ...picks }} label="Combined" reduced={reduced} />
              <dl className="study-summary">
                {steps.map((item) => (
                  <div key={item.id}>
                    <dt>{item.title}</dt>
                    <dd>
                      {picks[item.id]
                        ? item.labels[(item.options as readonly string[]).indexOf(picks[item.id]!)]
                        : `Undecided (baseline: ${defaults[item.id]})`}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="study-instructions">
                Your batch is saved. Tell me when you want it reviewed; you can revisit any tab without
                stopping between decisions.
              </p>
            </section>
          )}
        </TabsContent>
      </Tabs>
      <label className="study-choice">
        <Switch checked={reduced} onCheckedChange={setReduced} />
        Reduce motion
      </label>
      {storageFailed ? (
        <p role="status">Browser storage is unavailable. Choices remain for this visit only.</p>
      ) : null}
      <footer>
        <p>
          Baseline in individual comparisons: 150ms hover delay, above, 12px gap, no fade, neutral border.
          Choices combine only in Review my batch.
        </p>
        <p>
          Keyboard focus opens immediately. Escape, activation, pointer exit and window blur dismiss; moving
          into another sample starts its own delay. Standard shadcn/Radix collision and accessibility behavior
          remain.
        </p>
        <p>
          No production UI or game saves change. Pointer/keyboard review only; controller and screen-context
          review remain pending.
        </p>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<TooltipStudy />);
