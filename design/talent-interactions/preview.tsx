import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Biohazard, Flame } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import { RadioGroup, RadioGroupItem } from "../../src/components/ui/radio-group";
import { Switch } from "../../src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/components/ui/tooltip";
import { TALENTS } from "../../src/game/content";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "../button-interactions/study.css";
import "./study.css";

const steps = [
  {
    id: "strength",
    title: "Unowned icon strength",
    options: ["45", "65", "80"],
    labels: ["45%", "65%", "80%"],
    instruction:
      "Only unowned icon strength changes. Owned icons use full keyword color; locked controls remain at 45% overall opacity. Compare how clearly ownership reads.",
    recommendation: "65%: visibly muted without losing the keyword identity.",
  },
  {
    id: "brighten",
    title: "Hover brightening",
    options: ["10", "20", "30"],
    labels: ["10% brighter", "20% brighter", "30% brighter"],
    instruction:
      "Hover the talent icon in each state. Only the brightness increase changes; there is no growth. Keyboard focus keeps one solid gold outline.",
    recommendation: "10%: a subtle response, preserving keyword colors.",
  },
  {
    id: "flash",
    title: "Purchase flash",
    options: ["fade", "rise"],
    labels: ["Gold then fade", "Rise then fade"],
    instruction:
      "Activate the available talent to simulate a purchase. Replay purchase resets it. Both options last 250ms: either start gold and fade, or rise to gold over 75ms and fade over 175ms. Move the pointer away to separate hover from purchase feedback.",
    recommendation:
      "Gold then fade: immediate confirmation with a quiet recovery. Focus and reduced motion suppress the flash.",
  },
] as const;
type StepId = (typeof steps)[number]["id"];
type Settings = Record<StepId, string>;
type Picks = Partial<Settings>;
const defaults: Settings = { strength: "65", brighten: "10", flash: "fade" };
const storageKey = "fauna-design-talent-picks-v1";
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
  keyword,
  reduced,
}: {
  settings: Settings;
  label: string;
  keyword: "poison" | "burn";
  reduced: boolean;
}) {
  const talent = TALENTS.find((item) => item.keyword === keyword);
  const [purchased, setPurchased] = useState(false);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(false), 250);
    return () => window.clearTimeout(timer);
  }, [flash]);
  if (!talent) return null;
  const Icon = keyword === "poison" ? Biohazard : Flame;
  return (
    <div
      className="talent-sample"
      data-strength={settings.strength}
      data-brighten={settings.brighten}
      data-flash={settings.flash}
      data-keyword={keyword}
      data-reduced={reduced}
    >
      {(["available", "owned", "locked"] as const).map((state) => {
        const owned = state === "owned" || (state === "available" && purchased);
        return (
          <div className="talent-state-row" key={state}>
            <span className="talent-state-label">
              {state === "available"
                ? purchased
                  ? "Purchased"
                  : "Available"
                : state === "owned"
                  ? "Owned"
                  : "Locked"}
            </span>
            <Tooltip>
              <TooltipTrigger asChild reopenOnPointerMove={false}>
                <Button
                  variant="outline"
                  className="review-talent"
                  aria-label={`${label}: ${talent.name}, ${owned ? "owned" : state}`}
                  aria-disabled={state === "locked" || undefined}
                  data-owned={owned}
                  data-flashing={state === "available" && flash}
                  onClick={() => {
                    if (state !== "available" || purchased) return;
                    setPurchased(true);
                    setFlash(true);
                  }}
                >
                  <Icon aria-hidden="true" />
                  {talent.name}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8} className="talent-tooltip" data-reduced={reduced}>
                <strong>{talent.name}</strong>
                <p>{talent.text}</p>
                <p>
                  {state === "locked"
                    ? "Requires an available talent point (study example)."
                    : owned
                      ? "Owned"
                      : "Available · 1 talent point"}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
      <Button
        variant="outline"
        className="talent-replay"
        disabled={!purchased}
        onClick={() => {
          setPurchased(false);
          setFlash(false);
        }}
      >
        Replay purchase
      </Button>
    </div>
  );
}
function TalentStudy() {
  const [stepId, setStepId] = useState("strength");
  const [picks, setPicks] = useState<Picks>(loadPicks);
  const [keyword, setKeyword] = useState<"poison" | "burn">("poison");
  const [reduced, setReduced] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const index = steps.findIndex((step) => step.id === stepId);
  const step = steps[index];
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(picks));
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
    setCopied(false);
    setCopyFailed(false);
  }, [picks]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (
        [
          "Tab",
          "Enter",
          " ",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Home",
          "End",
          "Escape",
        ].includes(event.key)
      )
        document.documentElement.dataset.focus = "visible";
    };
    const pointer = () => {
      document.documentElement.dataset.focus = "hidden";
    };
    document.documentElement.dataset.focus = "hidden";
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", pointer, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", pointer, true);
      delete document.documentElement.dataset.focus;
    };
  }, []);
  async function copyChoices() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ study: "talent-states", choices: picks }, null, 2),
      );
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  }
  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <main className="button-study talent-study" data-reduced={reduced}>
        <header className="study-heading">
          <p className="keyword-eyebrow">Fauna · preferences</p>
          <h1>Talent states</h1>
          <p>
            Compare available, owned and locked talents using real keyword colors. Your phone choices form the
            baseline; these three fine details remain open.
          </p>
        </header>
        <div className="study-controls">
          <RadioGroup
            value={keyword}
            onValueChange={(value) => setKeyword(value as "poison" | "burn")}
            aria-label="Talent keyword"
            className="study-role"
          >
            <label>
              <RadioGroupItem value="poison" />
              Poison
            </label>
            <label>
              <RadioGroupItem value="burn" />
              Burn
            </label>
          </RadioGroup>
          <label>
            <Switch checked={reduced} onCheckedChange={setReduced} />
            Reduce motion
          </label>
        </div>
        <Tabs value={stepId} onValueChange={setStepId}>
          <TabsList className="study-tabs" aria-label="Talent decisions">
            {steps.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.title}
                {picks[item.id] ? " · chosen" : ""}
              </TabsTrigger>
            ))}
            <TabsTrigger value="combined">Review my choices</TabsTrigger>
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
                        key={`${step.id}-${value}-${keyword}`}
                        settings={{ ...defaults, [step.id]: value }}
                        label={step.labels[i] ?? value}
                        keyword={keyword}
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
                    {index === steps.length - 1 ? "Review my choices" : "Next decision"}
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
                <h2>Your combined talent states</h2>
                <p className="study-instructions">
                  Explicit choices are combined here. Unchosen values use the comparison baseline and remain
                  undecided.
                </p>
                <Sample
                  key={`combined-${keyword}`}
                  settings={{ ...defaults, ...picks }}
                  label="Combined"
                  keyword={keyword}
                  reduced={reduced}
                />
                <dl className="study-summary">
                  {steps.map((item) => (
                    <div key={item.id}>
                      <dt>{item.title}</dt>
                      <dd>
                        {picks[item.id]
                          ? item.labels[(item.options as readonly string[]).indexOf(picks[item.id]!)]
                          : "Undecided"}
                      </dd>
                    </div>
                  ))}
                </dl>
                <Button variant="outline" onClick={() => void copyChoices()}>
                  {copied ? "Copied choices" : "Copy choices"}
                </Button>
                {copyFailed ? (
                  <p role="status">
                    Could not copy. Your choices remain visible above and saved in this browser when storage
                    is available.
                  </p>
                ) : null}
              </section>
            )}
          </TabsContent>
        </Tabs>
        {storageFailed ? (
          <p role="status">Browser storage is unavailable. Choices remain for this visit only.</p>
        ) : null}
        <footer>
          <p>
            Baseline: 65% unowned icon strength, 10% hover brightening and a fading purchase flash. Each
            comparison varies one detail. No fine-tuning choice is preselected.
          </p>
          <p>
            Carried forward: keyword-colored icons, black owned background, no checkmarks, locked controls at
            45% opacity with requirement tooltips, no hover growth, a 150ms color transition and a 250ms gold
            purchase flash.
          </p>
          <p>
            Hover or focus any talent for its rules. Activate the available one to simulate purchase; Replay
            purchase resets it for another try. Focus suppresses the border flash. Reduced motion removes
            transitions and flash. No game saves or production UI change.
          </p>
          <p>
            <a href="/design/keyword-interactions/index.html">Keyword study</a> ·{" "}
            <a href="/design/artwork-interactions/index.html">Artwork study</a> ·{" "}
            <a href="/design/button-interactions/index.html">Buttons study</a>
          </p>
        </footer>
      </main>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<TalentStudy />);
