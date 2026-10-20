import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LoaderCircle } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import { Switch } from "../../src/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "../../src/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "./study.css";

const decisions = [
  {
    id: "hover-fill",
    title: "Hover fill",
    instruction: "Move between the buttons. Only the hovered fill changes.",
    recommendation: "Subtle",
    options: ["None", "Subtle", "Stronger"],
  },
  {
    id: "hover-border",
    title: "Hover border",
    instruction: "Hover each button. Only its border color changes.",
    recommendation: "Lighter neutral",
    options: ["Unchanged", "Lighter neutral", "Gold"],
  },
  {
    id: "hover-motion",
    title: "Hover movement",
    instruction: "Hover each button. Fill and border remain unchanged.",
    recommendation: "Still",
    options: ["Still", "Grow 3.5%", "Lift 2px"],
  },
  {
    id: "focus-fill",
    title: "Focus fill",
    instruction: "Use Tab or Shift+Tab. Only the focused fill changes; the same dashed outline remains.",
    recommendation: "None",
    options: ["None", "Subtle", "Stronger"],
  },
  {
    id: "focus-border",
    title: "Focus border",
    instruction:
      "Use Tab or Shift+Tab. Only the focused border color changes; the same dashed outline remains.",
    recommendation: "Unchanged",
    options: ["Unchanged", "Lighter neutral", "Gold"],
  },
  {
    id: "focus-outline",
    title: "Focus outline",
    instruction: "Use Tab or Shift+Tab to focus a sample. Compare only the external outline.",
    recommendation: "Dashed",
    options: ["Dashed", "Solid", "Double"],
  },
  {
    id: "focus-motion",
    title: "Focus movement",
    instruction: "Use Tab or Shift+Tab. The same dashed focus outline remains in every sample.",
    recommendation: "Still",
    options: ["Still", "Grow 3.5%", "Lift 2px"],
  },
  {
    id: "press-fill",
    title: "Pressed fill",
    instruction: "Hold a mouse click, Space or Enter. Only the pressed fill changes.",
    recommendation: "Subtle",
    options: ["Unchanged", "Subtle", "Stronger"],
  },
  {
    id: "press-border",
    title: "Pressed border",
    instruction: "Hold a mouse click, Space or Enter. Only the pressed border color changes.",
    recommendation: "Lighter neutral",
    options: ["Unchanged", "Lighter neutral", "Gold"],
  },
  {
    id: "press-motion",
    title: "Pressed movement",
    instruction: "Hold a mouse click, Space or Enter. Compare only movement while held.",
    recommendation: "Still",
    options: ["Still", "Shrink 2%", "Lower 1px"],
  },
  {
    id: "timing",
    title: "Transition timing",
    instruction: "Hover each sample. All use the same fill change; only its duration differs.",
    recommendation: "150ms",
    options: ["Instant", "150ms", "200ms"],
  },
  {
    id: "unavailable",
    title: "Unavailable contrast",
    instruction:
      "These samples are disabled. Compare readability only; none can activate or receive Tab focus.",
    recommendation: "65%",
    options: ["50%", "65%", "80%"],
  },
  {
    id: "busy",
    title: "Busy indicator",
    instruction: "Activate each sample to start the same 1.2-second wait. Only the busy indicator differs.",
    recommendation: "Text",
    options: ["Text", "Text + spinner"],
  },
] as const;
type DecisionId = (typeof decisions)[number]["id"];
type Picks = Partial<Record<DecisionId, string>>;
const storageKey = "fauna-design-button-picks-v1";
function loadPicks(): Picks {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    return Object.fromEntries(
      decisions.flatMap((decision) => {
        const value = saved?.[decision.id];
        return typeof value === "string" && (decision.options as readonly string[]).includes(value)
          ? [[decision.id, value]]
          : [];
      }),
    );
  } catch {
    return {};
  }
}

function Sample({ settings, primary, label }: { settings: Picks; primary: boolean; label: string }) {
  const [count, setCount] = useState(0);
  const [held, setHeld] = useState(false);
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
    <div
      className="study-demo"
      data-role={primary ? "primary" : "supporting"}
      data-hover-fill={settings["hover-fill"]}
      data-hover-border={settings["hover-border"]}
      data-hover-motion={settings["hover-motion"]}
      data-focus-outline={settings["focus-outline"]}
      data-focus-motion={settings["focus-motion"]}
      data-focus-fill={settings["focus-fill"]}
      data-focus-border={settings["focus-border"]}
      data-press-border={settings["press-border"]}
      data-press-fill={settings["press-fill"]}
      data-press-motion={settings["press-motion"]}
      data-timing={settings.timing}
      data-unavailable={settings.unavailable}
    >
      <Button
        className="study-action"
        variant={primary ? "default" : "outline"}
        disabled={Boolean(settings.unavailable) || waiting}
        aria-busy={waiting}
        data-held={held || undefined}
        aria-label={`${label}: ${primary ? "Begin battle" : "Deck"}`}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") setHeld(true);
        }}
        onKeyUp={() => setHeld(false)}
        onBlur={() => setHeld(false)}
        onClick={() => (settings.busy ? setWaiting(true) : setCount((value) => value + 1))}
      >
        {waiting && settings.busy === "Text + spinner" ? (
          <LoaderCircle className="study-spinner" aria-hidden="true" />
        ) : null}
        {waiting ? "Working…" : primary ? "Begin battle" : "Deck"}
      </Button>
      <output aria-live="polite">{waiting ? "Waiting…" : `Actions accepted: ${count}`}</output>
    </div>
  );
}

function ButtonStudy() {
  const [step, setStep] = useState("hover-fill");
  const [primary, setPrimary] = useState("supporting");
  const [reduced, setReduced] = useState(false);
  const [picks, setPicks] = useState<Picks>(loadPicks);
  const [combinedUnavailable, setCombinedUnavailable] = useState(false);
  const [combinedBusy, setCombinedBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const decision = decisions.find((item) => item.id === step);
  const index = decisions.findIndex((item) => item.id === step);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(picks));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [picks]);
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
        <h1>Buttons · one behavior at a time</h1>
        <p>
          Actual Fauna shadcn/ui components. Choices stay in this browser; game UI and saves are untouched.
        </p>
      </header>
      <Tabs value={step} onValueChange={setStep}>
        <TabsList className="study-tabs" aria-label="Button behaviors">
          {decisions.map((item) => (
            <TabsTrigger value={item.id} key={item.id}>
              {item.title}
            </TabsTrigger>
          ))}
          <TabsTrigger value="combined">Combine my choices</TabsTrigger>
        </TabsList>
        <TabsContent value={step}>
          <div className="study-controls">
            <RadioGroup
              value={primary}
              onValueChange={setPrimary}
              aria-label="Button role"
              className="study-role"
            >
              <label>
                <RadioGroupItem value="supporting" />
                Supporting button
              </label>
              <label>
                <RadioGroupItem value="primary" />
                Primary button
              </label>
            </RadioGroup>
            <label>
              <Switch checked={reduced} onCheckedChange={setReduced} />
              Reduce motion
            </label>
          </div>
          {decision ? (
            <section aria-labelledby="decision-title" key={step}>
              <h2 id="decision-title">
                {index + 1}. {decision.title}
              </h2>
              <p className="study-instructions">{decision.instruction}</p>
              <p className="study-instructions">
                Other effects are held constant. Keyboard focus remains visible, including while comparing
                outlines.
              </p>
              <RadioGroup
                value={picks[decision.id] ?? ""}
                onValueChange={(value) => setPicks((previous) => ({ ...previous, [decision.id]: value }))}
                aria-label={`Choose ${decision.title.toLowerCase()}`}
                className="study-grid"
              >
                {decision.options.map((option, i) => (
                  <section className="study-sample" key={option}>
                    <h3>
                      {String.fromCharCode(65 + i)} · {option}
                    </h3>
                    <Sample
                      key={`${step}-${primary}-${option}`}
                      primary={primary === "primary"}
                      label={option}
                      settings={{
                        [decision.id]: option,
                        ...(decision.id === "timing" ? { "hover-fill": "Subtle" } : {}),
                      }}
                    />
                    <label className="study-choice">
                      <RadioGroupItem value={option} />
                      Choose {option.toLowerCase()}
                    </label>
                  </section>
                ))}
              </RadioGroup>
              <p className="study-recommendation">
                My recommendation: {decision.recommendation}. Your choice: {picks[decision.id] ?? "Undecided"}
                .
              </p>
              <nav className="study-navigation" aria-label="Review steps">
                <Button
                  variant="outline"
                  disabled={!picks[decision.id]}
                  onClick={() =>
                    setPicks((previous) => {
                      const next = { ...previous };
                      delete next[decision.id];
                      return next;
                    })
                  }
                >
                  Clear this choice
                </Button>
                <Button
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => setStep(decisions[index - 1]?.id ?? decision.id)}
                >
                  Previous behavior
                </Button>
                <Button variant="outline" onClick={() => setStep(decisions[index + 1]?.id ?? "combined")}>
                  Next behavior
                </Button>
              </nav>
            </section>
          ) : (
            <section aria-labelledby="combined-title">
              <h2 id="combined-title">Combine my choices</h2>
              <p className="study-instructions">
                Only your explicit choices are applied. Undecided behaviors use a still button with no extra
                fill or border effect and a dashed focus outline.
              </p>
              <div className="study-controls">
                <label>
                  <Switch checked={combinedUnavailable} onCheckedChange={setCombinedUnavailable} />
                  Preview unavailable state
                </label>
                <label>
                  <Switch checked={combinedBusy} onCheckedChange={setCombinedBusy} />
                  Preview busy action
                </label>
              </div>
              <Sample
                key={`combined-${primary}`}
                settings={{
                  ...picks,
                  unavailable: combinedUnavailable ? picks.unavailable : undefined,
                  busy: combinedBusy ? picks.busy : undefined,
                }}
                primary={primary === "primary"}
                label="Combined choices"
              />
              <dl className="study-summary">
                {decisions.map((item) => (
                  <div key={item.id}>
                    <dt>{item.title}</dt>
                    <dd>{picks[item.id] ?? "Undecided"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {saveFailed ? (
            <p role="status">Browser storage is unavailable. Your choices remain for this visit only.</p>
          ) : null}
        </TabsContent>
      </Tabs>
      <footer>
        <p>Selections are provisional. Nothing is applied to the game until we review the combination.</p>
        <p>Mouse and keyboard study. Gamepad navigation is not connected.</p>
        <p>
          Next: icon buttons, artwork cards, tabs, switches, radio choices, sliders, tooltips, dialogs,
          progress and battle feedback. Each gets its own state comparisons.
        </p>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<ButtonStudy />);
