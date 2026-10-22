import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BookOpen, Eye, HelpCircle, Monitor, StepForward, Volume2 } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import { RadioGroup, RadioGroupItem } from "../../src/components/ui/radio-group";
import { Switch } from "../../src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "../button-interactions/study.css";
import "./study.css";

const steps = [
  {
    id: "fill",
    title: "Active fill",
    options: ["black", "charcoal", "gold"],
    labels: ["Black", "Charcoal", "Gold"],
    recommendation:
      "Black: keeps the active tab distinct on the charcoal strip without competing with primary actions.",
    instruction:
      "Only the active tab’s fill changes. Gold uses its matching dark text for contrast. Every sample keeps the same gold active border.",
  },
  {
    id: "hover",
    title: "Inactive hover",
    options: ["none", "subtle", "stronger"],
    labels: ["None", "Subtle", "Stronger"],
    recommendation: "Subtle: makes the hovered tab easy to spot without making it look selected.",
    instruction:
      "Hover an inactive tab. Only its fill changes; clicking or using arrow keys changes the active tab.",
  },
  {
    id: "gap",
    title: "Tab spacing",
    options: ["4", "8", "12"],
    labels: ["4px", "8px", "12px"],
    recommendation: "4px inside the shared strip; larger gaps are available to compare.",
    instruction: "Only spacing between tabs changes. Button padding, height and text remain fixed.",
  },
  {
    id: "padding",
    title: "Horizontal padding",
    options: ["12", "16", "20"],
    labels: ["12px per side", "16px per side", "20px per side"],
    recommendation: "12px: compact while preserving the 44px control height.",
    instruction:
      "Only horizontal padding inside each tab changes. Try the narrow strip to judge overflow; controls scroll rather than shrink.",
  },
  {
    id: "labels",
    title: "Icons and labels",
    options: ["text", "icons"],
    labels: ["Labels only", "Icons + labels"],
    recommendation:
      "Labels only as the shared baseline. Choose icons + labels if the symbols help you scan; test both contexts.",
    instruction: "Only the presence of a 20px icon changes. Accessible names and labels are identical.",
  },
  {
    id: "timing",
    title: "Transition timing",
    options: ["0", "100", "150"],
    labels: ["Immediate", "100ms", "150ms"],
    recommendation: "150ms to match your buttons. Panel changes remain immediate in every option.",
    instruction:
      "Only fill and border transition duration changes. Hover, click or use Left/Right arrows. Input never waits for animation.",
  },
] as const;
type StepId = (typeof steps)[number]["id"];
type Picks = Partial<Record<StepId, string>>;
const defaults = { fill: "black", hover: "subtle", gap: "4", padding: "12", labels: "text", timing: "150" };
const storageKey = "fauna-design-tab-picks-v1";
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
const contexts = {
  settings: [
    { id: "display", label: "Display", Icon: Monitor },
    { id: "sound", label: "Sound", Icon: Volume2 },
    { id: "battle", label: "Battle", Icon: StepForward },
  ],
  collection: [
    { id: "all", label: "All", Icon: BookOpen },
    { id: "known", label: "Known", Icon: Eye },
    { id: "unknown", label: "Unknown", Icon: HelpCircle },
  ],
};
function Sample({
  settings,
  label,
  context,
  narrow,
  reduced,
}: {
  settings: typeof defaults;
  label: string;
  context: keyof typeof contexts;
  narrow: boolean;
  reduced: boolean;
}) {
  const items = contexts[context];
  const [active, setActive] = useState(items[0]?.id ?? "");
  return (
    <div
      className="tab-sample"
      data-fill={settings.fill}
      data-hover={settings.hover}
      data-gap={settings.gap}
      data-padding={settings.padding}
      data-timing={settings.timing}
      data-reduced={reduced}
    >
      <div className="tab-strip-width" data-narrow={narrow}>
        <Tabs value={active} onValueChange={setActive}>
          <TabsList
            className="review-tab-list"
            aria-label={`${label}: ${context === "settings" ? "Settings categories" : "Collection filters"}`}
          >
            {items.map((item) => (
              <TabsTrigger className="review-tab" key={item.id} value={item.id}>
                {settings.labels === "icons" ? <item.Icon aria-hidden="true" /> : null}
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {items.map((item) => (
            <TabsContent key={item.id} value={item.id} className="review-tab-panel">
              <p>{item.label} content</p>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
function TabStudy() {
  const [stepId, setStepId] = useState("fill");
  const [picks, setPicks] = useState<Picks>(loadPicks);
  const [context, setContext] = useState<keyof typeof contexts>("settings");
  const [narrow, setNarrow] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const index = steps.findIndex((step) => step.id === stepId);
  const step = steps[index];
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(picks));
      // eslint-disable-next-line react/set-state-in-effect -- This prototype reports the result of writing to external browser storage
      setStorageFailed(false);
    } catch {
      // eslint-disable-next-line react/set-state-in-effect -- Failed external storage writes must remain visible in the prototype
      setStorageFailed(true);
    }
  }, [picks]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        ["Tab", "Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(
          event.key,
        )
      )
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
    <main className="button-study tab-study" data-reduced={reduced}>
      <header className="study-heading">
        <h1>Tabs · review a batch</h1>
        <p>
          Six independent decisions using actual shadcn Tabs. Select options and keep going with Next
          decision.
        </p>
      </header>
      <div className="study-controls">
        <RadioGroup
          value={context}
          onValueChange={(value) => setContext(value as keyof typeof contexts)}
          aria-label="Tab context"
          className="study-role"
        >
          <label>
            <RadioGroupItem value="settings" />
            Settings
          </label>
          <label>
            <RadioGroupItem value="collection" />
            Collection
          </label>
        </RadioGroup>
        <label>
          <Switch checked={narrow} onCheckedChange={setNarrow} />
          Narrow strip
        </label>
        <label>
          <Switch checked={reduced} onCheckedChange={setReduced} />
          Reduce motion
        </label>
      </div>
      <Tabs value={stepId} onValueChange={setStepId}>
        <TabsList className="study-tabs" aria-label="Tab decisions">
          {steps.map((item) => (
            <TabsTrigger value={item.id} key={item.id}>
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
                  <section key={value} className="study-sample">
                    <h3>
                      {String.fromCharCode(65 + i)} · {step.labels[i]}
                    </h3>
                    <Sample
                      key={`${step.id}-${value}-${context}`}
                      settings={{ ...defaults, [step.id]: value }}
                      label={step.labels[i] ?? value}
                      context={context}
                      narrow={narrow}
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
              <h2>Your tab batch</h2>
              <p className="study-instructions">
                Only explicit preferences are combined. Undecided values use the stated comparison baseline.
              </p>
              <Sample
                key={`combined-${context}`}
                settings={{ ...defaults, ...picks }}
                label="Combined"
                context={context}
                narrow={narrow}
                reduced={reduced}
              />
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
              <p className="study-instructions">Your batch is saved. Return for review whenever ready.</p>
            </section>
          )}
        </TabsContent>
      </Tabs>
      {storageFailed ? (
        <p role="status">Browser storage is unavailable. Choices remain for this visit only.</p>
      ) : null}
      <footer>
        <p>
          Baseline: black active fill, subtle inactive hover, 4px spacing, 12px horizontal padding, labels
          only, 150ms transitions. Each individual comparison changes one property.
        </p>
        <p>
          Selected tabs retain their appearance on hover. Keyboard focus replaces that border with your solid
          external outline, retaining the active fill and one highlighted boundary.
        </p>
        <p>
          Tab enters the tab list. Left/Right, Home and End follow shadcn/Radix navigation and activate panels
          immediately. Narrow lists scroll rather than resizing controls.
        </p>
        <p>
          No game settings, saves or production UI change. Controller and full screen review remain pending.
        </p>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<TabStudy />);
