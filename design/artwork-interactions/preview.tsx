import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "../../src/components/ui/button";
import { RadioGroup, RadioGroupItem } from "../../src/components/ui/radio-group";
import { Switch } from "../../src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/components/ui/tooltip";
import { ArtCard } from "../../src/ui/art-card";
import { assetUrl } from "../../src/ui/assets";
import { reviewedArtworkChoices } from "./reviewed-choices";
import { reviewedTooltipChoices } from "../tooltip-interactions/reviewed-choices";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "../button-interactions/study.css";
import "../tooltip-interactions/study.css";
import "./study.css";

const steps = [
  {
    id: "frame",
    title: "Hover frame",
    options: ["1", "2", "3"],
    labels: ["1px", "2px", "3px"],
    recommendation: "2px: visible without covering much artwork.",
    instruction:
      "Hover each card. Only the thickness of its gold inner frame changes. Resting artwork dimensions are identical.",
  },
  {
    id: "motion",
    title: "Hover movement",
    options: ["still", "grow", "lift"],
    labels: ["Still", "Grow 3.5%", "Lift 4px"],
    recommendation: "Grow 3.5% to match your buttons; battle hand lift remains a separate context review.",
    instruction: "Only pointer hover movement changes. The same 2px hover frame remains in every option.",
  },
  {
    id: "ringGap",
    title: "Selection distance",
    options: ["1", "2", "3"],
    labels: ["1px gap", "2px gap", "3px gap"],
    recommendation: "3px: a clear break between artwork and selection.",
    instruction:
      "Cards begin selected. Only the selection ring’s distance from the card changes. Click to toggle selection; Tab to compare selection plus focus.",
  },
  {
    id: "ringWidth",
    title: "Selection thickness",
    options: ["2", "3", "4"],
    labels: ["2px", "3px", "4px"],
    recommendation: "2px: readable alongside the separate external focus outline.",
    instruction:
      "Cards begin selected. Only selection ring thickness changes. Focus stays outside the selection ring with a clear gap.",
  },
  {
    id: "unavailable",
    title: "Unavailable contrast",
    options: ["45", "60", "75"],
    labels: ["45%", "60%", "75%"],
    recommendation: "60%: unavailable while retaining enough artwork detail to inspect.",
    instruction:
      "Only opacity changes. No grayscale is added. These cards cannot be selected, but hover and keyboard focus still reveal details.",
  },
  {
    id: "knockout",
    title: "Knockout contrast",
    options: ["30", "45", "60"],
    labels: ["30%", "45%", "60%"],
    recommendation:
      "45%: grayscale plus readable detail. Gameplay knockout indicators are reviewed later in battle context.",
    instruction:
      "All cards are grayscale and unavailable for selection. Only opacity changes. Hover/focus details stay available.",
  },
  {
    id: "selectedHover",
    title: "Selected hover",
    options: ["ring", "stronger"],
    labels: ["Keep single ring", "Strengthen single ring"],
    recommendation: "Keep single ring: your 3.5% growth already signals hover; selection stays stable.",
    instruction:
      "Both start selected and suppress the inner hover frame. Hover to compare an unchanged 2px selection ring against the same ring thickening to 3px. Click to deselect and see your usual 2px hover frame return.",
  },
] as const;
type StepId = (typeof steps)[number]["id"];
type Picks = Partial<Record<StepId, string>>;
const storageKey = "fauna-design-artwork-picks-v1";
const defaults = {
  frame: "2",
  motion: "still",
  ringGap: "3",
  ringWidth: "2",
  unavailable: "",
  knockout: "",
  selectedHover: "ring",
};
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
  aspect,
  selectedInitially = false,
}: {
  settings: typeof defaults;
  label: string;
  reduced: boolean;
  aspect: "creature" | "action";
  selectedInitially?: boolean;
}) {
  const [selected, setSelected] = useState(selectedInitially);
  const unavailable = Boolean(settings.unavailable || settings.knockout);
  const name = aspect === "creature" ? "Mossback" : "Mossback action";
  return (
    <div
      className="art-sample"
      data-frame={settings.frame}
      data-motion={settings.motion}
      data-ring-gap={settings.ringGap}
      data-ring-width={settings.ringWidth}
      data-unavailable={settings.unavailable || undefined}
      data-knockout={settings.knockout || undefined}
      data-selected={selected}
      data-selected-hover={settings.selectedHover}
    >
      <TooltipProvider delayDuration={Number(reviewedTooltipChoices.delay)}>
        <Tooltip>
          <TooltipTrigger asChild reopenOnPointerMove={false}>
            <ArtCard
              artwork={assetUrl(`${aspect}.mossback`)}
              aspect={aspect}
              className="review-art"
              aria-label={`${label}: ${name}`}
              aria-pressed={selected}
              aria-disabled={unavailable || undefined}
              onClick={() => {
                if (!unavailable) setSelected((value) => !value);
              }}
            />
          </TooltipTrigger>
          <TooltipContent
            className="tooltip-review-content"
            side={reviewedTooltipChoices.side}
            sideOffset={Number(reviewedTooltipChoices.gap)}
            data-fade={reviewedTooltipChoices.fade}
            data-border={reviewedTooltipChoices.border}
            data-reduced={reduced}
          >
            <strong>{name}</strong>
            <p>
              {settings.knockout
                ? "Knocked out. Cannot be selected."
                : settings.unavailable
                  ? "Unavailable for selection."
                  : "Click or press Space/Enter to toggle selection."}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <p className="art-status" aria-live="polite">
        {unavailable
          ? settings.knockout
            ? "Knocked out · details available"
            : "Unavailable · details available"
          : selected
            ? "✓ Selected"
            : "Not selected"}
      </p>
    </div>
  );
}
function ArtworkStudy() {
  const [stepId, setStepId] = useState(() =>
    new URLSearchParams(window.location.search).get("step") === "selected-hover" ? "selectedHover" : "frame",
  );
  const [picks, setPicks] = useState<Picks>(loadPicks);
  const [aspect, setAspect] = useState("creature");
  const [previewState, setPreviewState] = useState("ready");
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
    <main className="button-study art-study" data-reduced={reduced}>
      <header className="study-heading">
        <h1>Artwork cards · review a batch</h1>
        <p>
          Real ArtCard surfaces at fixed artwork sizes. One behavior changes per step; your tooltip choices
          stay fixed.
        </p>
      </header>
      <RadioGroup
        value={aspect}
        onValueChange={setAspect}
        aria-label="Artwork format"
        className="study-controls"
      >
        <label>
          <RadioGroupItem value="creature" />
          Creature · landscape
        </label>
        <label>
          <RadioGroupItem value="action" />
          Action · portrait
        </label>
      </RadioGroup>
      <Tabs value={stepId} onValueChange={setStepId}>
        <TabsList className="study-tabs" aria-label="Artwork decisions">
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
                      settings={{
                        ...defaults,
                        ...(step.id === "selectedHover"
                          ? { ...reviewedArtworkChoices, unavailable: "", knockout: "" }
                          : {}),
                        [step.id]: value,
                      }}
                      label={step.labels[i] ?? value}
                      reduced={reduced}
                      aspect={aspect as "creature" | "action"}
                      selectedInitially={
                        step.id === "ringGap" || step.id === "ringWidth" || step.id === "selectedHover"
                      }
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
              <h2>Your artwork batch</h2>
              <p className="study-instructions">
                Try your combination below. Undecided values use the stated comparison baseline, not an
                assumed preference. Unchosen contrast previews use 60% for unavailable and 45% for knockout.
              </p>
              <RadioGroup
                value={previewState}
                onValueChange={setPreviewState}
                aria-label="Preview availability"
                className="study-controls"
              >
                <label>
                  <RadioGroupItem value="ready" />
                  Available
                </label>
                <label>
                  <RadioGroupItem value="unavailable" />
                  Unavailable
                </label>
                <label>
                  <RadioGroupItem value="knockout" />
                  Knocked out
                </label>
              </RadioGroup>
              <Sample
                settings={{
                  ...defaults,
                  ...picks,
                  unavailable: previewState === "unavailable" ? (picks.unavailable ?? "60") : "",
                  knockout: previewState === "knockout" ? (picks.knockout ?? "45") : "",
                }}
                label="Combined"
                reduced={reduced}
                aspect={aspect as "creature" | "action"}
              />
              <dl className="study-summary">
                {steps.map((item) => (
                  <div key={item.id}>
                    <dt>{item.title}</dt>
                    <dd>
                      {picks[item.id]
                        ? item.labels[(item.options as readonly string[]).indexOf(picks[item.id]!)]
                        : `Undecided (baseline: ${item.id === "unavailable" ? "60% in unavailable preview" : item.id === "knockout" ? "45% in knockout preview" : defaults[item.id]})`}
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
          {stepId === "selectedHover"
            ? "This refinement uses your recorded artwork choices: 2px frame, 3.5% growth, 3px selection gap and 2px ring. Only the selected-hover ring reaction changes."
            : "Baseline: 2px hover frame, no hover movement, 3px selection gap, 2px selection ring. Solid focus stays outside selection. Choices combine only in Review my batch."}
        </p>
        <p>
          Your tooltip baseline: immediate, above, 8px gap, 100ms fade, neutral border. These selection
          samples do not replace real inspection or battle targeting review.
        </p>
        <p>
          No production UI or game saves change. Pointer/keyboard review only; controller and screen-context
          review remain pending.
        </p>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<ArtworkStudy />);
