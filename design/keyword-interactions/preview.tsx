import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../../src/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "../../src/components/ui/radio-group";
import { Switch } from "../../src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/components/ui/tooltip";
import { KEYWORD_DEFINITIONS, type KeywordId } from "../../src/game/keywords";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "../button-interactions/study.css";
import "./study.css";

const steps = [
  {
    id: "rest",
    title: "Resting appearance",
    options: ["dotted", "color"],
    labels: ["Dotted underline", "Color only"],
    instruction:
      "Only the resting underline changes. Hover or focus the keyword for its definition; click or press Enter to open details.",
    recommendation:
      "Dotted underline: distinguishes an interactive reference from ordinary colored rules text.",
  },
  {
    id: "hover",
    title: "Hover feedback",
    options: ["solid", "brighten"],
    labels: ["Solid underline", "Brighter text"],
    instruction:
      "Only hover feedback changes. Compare the keyword before and during hover. Keyboard focus keeps the established solid gold outline.",
    recommendation:
      "Solid underline, without movement. This remains distinguishable without relying on color.",
  },
  {
    id: "navigation",
    title: "Nested details",
    options: ["fade", "instant"],
    labels: ["150ms crossfade", "Immediate"],
    instruction:
      "Open the keyword, then follow its related keyword and use Back. Only the transition between detail pages changes; dialog opening and closing remain 150ms.",
    recommendation:
      "150ms crossfade, matching the return-from-inspection preference. Navigation takes effect immediately.",
  },
] as const;
type StepId = (typeof steps)[number]["id"];
type Settings = Record<StepId, string>;
type Picks = Partial<Settings>;
const defaults: Settings = { rest: "dotted", hover: "solid", navigation: "fade" };
const storageKey = "fauna-design-keyword-picks-v1";
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
  keyword: "poison" | "block";
  reduced: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<KeywordId[]>([keyword]);
  const [outgoing, setOutgoing] = useState<KeywordId | null>(null);
  const [revision, setRevision] = useState(0);
  const backRef = useRef<HTMLButtonElement>(null);
  const current = history.at(-1) ?? keyword;
  const definition = KEYWORD_DEFINITIONS[current];
  const related: KeywordId = current === "poison" ? "block" : current === "block" ? "health" : "poison";
  useEffect(() => {
    if (outgoing === null) return;
    const timer = window.setTimeout(
      () => setOutgoing(null),
      reduced || settings.navigation === "instant" ? 0 : 150,
    );
    return () => window.clearTimeout(timer);
  }, [outgoing, revision, reduced, settings.navigation]);
  const navigate = (next: KeywordId[], focusBack = false) => {
    setOutgoing(reduced || settings.navigation === "instant" ? null : current);
    setHistory(next);
    setRevision((value) => value + 1);
    if (focusBack) backRef.current?.focus();
  };
  return (
    <div className="keyword-sample" data-rest={settings.rest} data-hover={settings.hover}>
      <p className="keyword-context">{keyword === "poison" ? "Damage type" : "Defense"}</p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setHistory([keyword]);
            setOutgoing(null);
          }
        }}
      >
        <p className="keyword-sentence">
          Read more about{" "}
          <Tooltip>
            <DialogTrigger asChild>
              <TooltipTrigger asChild reopenOnPointerMove={false}>
                <Button
                  variant="link"
                  className="keyword-reference"
                  data-keyword={keyword}
                  aria-label={`${label}: inspect ${KEYWORD_DEFINITIONS[keyword].label}`}
                >
                  {KEYWORD_DEFINITIONS[keyword].label}
                </Button>
              </TooltipTrigger>
            </DialogTrigger>
            <TooltipContent side="top" sideOffset={8} className="keyword-tooltip" data-reduced={reduced}>
              <strong>{KEYWORD_DEFINITIONS[keyword].label}</strong>
              <p>{KEYWORD_DEFINITIONS[keyword].description}</p>
            </TooltipContent>
          </Tooltip>{" "}
          in the glossary.
        </p>
        <p className="keyword-sample-help">Hover · Tab to focus · Enter to inspect</p>
        <DialogContent className="keyword-dialog" data-reduced={reduced}>
          <DialogTitle>Keyword details</DialogTitle>
          <DialogDescription>Explore a related keyword, then return with Back.</DialogDescription>
          <div className="keyword-detail-stack" data-navigation={settings.navigation} data-reduced={reduced}>
            {outgoing ? (
              <section className="keyword-detail outgoing" aria-hidden="true" inert key={`old-${revision}`}>
                <h3 data-keyword={outgoing}>{KEYWORD_DEFINITIONS[outgoing].label}</h3>
                <p>{KEYWORD_DEFINITIONS[outgoing].description}</p>
              </section>
            ) : null}
            <section className="keyword-detail current" key={revision} data-animate={outgoing !== null}>
              <h3 data-keyword={current}>{definition.label}</h3>
              <p>{definition.description}</p>
              <Button
                variant="link"
                className="keyword-related"
                data-keyword={related}
                onClick={() => navigate([...history, related], true)}
              >
                Inspect {KEYWORD_DEFINITIONS[related].label}
              </Button>
            </section>
          </div>
          <Button
            variant="outline"
            ref={backRef}
            onClick={() => (history.length === 1 ? setOpen(false) : navigate(history.slice(0, -1)))}
          >
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function KeywordStudy() {
  const [stepId, setStepId] = useState("rest");
  const [picks, setPicks] = useState<Picks>(loadPicks);
  const [keyword, setKeyword] = useState<"poison" | "block">("poison");
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
        JSON.stringify({ study: "keyword-references", choices: picks }, null, 2),
      );
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  }
  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <main className="button-study keyword-study" data-reduced={reduced}>
        <header className="study-heading">
          <p className="keyword-eyebrow">Fauna · preferences</p>
          <h1>Keyword references</h1>
          <p>
            Three independent decisions. Try each option, choose, then continue. Your phone decisions remain
            saved; these choices are still open.
          </p>
        </header>
        <div className="study-controls">
          <RadioGroup
            value={keyword}
            onValueChange={(value) => setKeyword(value as "poison" | "block")}
            aria-label="Keyword context"
            className="study-role"
          >
            <label>
              <RadioGroupItem value="poison" />
              Poison
            </label>
            <label>
              <RadioGroupItem value="block" />
              Block
            </label>
          </RadioGroup>
          <label>
            <Switch checked={reduced} onCheckedChange={setReduced} />
            Reduce motion
          </label>
        </div>
        <Tabs value={stepId} onValueChange={setStepId}>
          <TabsList className="study-tabs" aria-label="Keyword decisions">
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
                <h2>Your combined keyword reference</h2>
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
            Baseline: dotted underline, solid underline on hover, 150ms nested crossfade. Each comparison
            varies one behavior. No choices are preselected.
          </p>
          <p>
            Carried forward: keyword colors, semibold names, left-aligned rules, immediate tooltip above with
            an 8px gap and 100ms fade, neutral tooltip border, 80% dialog backdrop, 150ms dialog fades and
            solid gold keyboard focus.
          </p>
          <p>
            Use Tab and Enter/Space, follow related details, then Back or Escape. Reduced motion removes
            fades. No game saves or production UI change.
          </p>
          <p>
            <a href="/design/tab-interactions/index.html">Tabs study</a> ·{" "}
            <a href="/design/artwork-interactions/index.html">Artwork study</a> ·{" "}
            <a href="/design/button-interactions/index.html">Buttons study</a>
          </p>
        </footer>
      </main>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<KeywordStudy />);
