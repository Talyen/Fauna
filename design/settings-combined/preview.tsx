import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../../src/components/ui/dialog";
import { Switch } from "../../src/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/components/ui/tooltip";
import { KeywordText } from "../../src/ui/shared/keyword-text";
import { KEYWORD_DEFINITIONS } from "../../src/game/keywords";
import { Settings } from "../../src/ui/settings/settings";
import { LanguageChoices } from "../../src/ui/settings/language-choices";
import { LocalizationProvider } from "../../src/ui/shared/localization/provider";
import { returnFocus } from "../../src/ui/shared/navigation/focus";
import {
  defaultAudioPreferences,
  type DevicePreferences,
  type PreferencesPatch,
} from "../../src/ui/settings/preferences";
import { createSession } from "../../src/application/session";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "../button-interactions/study.css";
import "./study.css";

function freshPreferences(): DevicePreferences {
  return {
    audio: { ...defaultAudioPreferences },
    scale: 1,
    tooltipScale: 1,
    autoEndTurn: true,
    glow: 100,
    particles: 100,
    controller: "auto",
  };
}

function SettingsReview() {
  const [open, setOpen] = useState(true);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [preferences, setPreferences] = useState(freshPreferences);
  const { scale, tooltipScale } = preferences;
  const [session] = useState(() =>
    createSession({
      desktop: false,
      steam: { available: false },
      saves: { readCandidates: async () => [], write: async () => {} },
    }),
  );
  useEffect(
    () => () => {
      void session.dispose();
    },
    [session],
  );
  const update = (patch: PreferencesPatch) =>
    setPreferences((previous) => ({
      ...previous,
      ...patch,
      audio: { ...previous.audio, ...patch.audio },
    }));
  const [reduced, setReduced] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [short, setShort] = useState(false);
  const [failed, setFailed] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [revision, setRevision] = useState(0);
  const scrollTimer = useRef<number | undefined>(undefined);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const previousText = root.style.getPropertyValue("--text-scale");
    const previousTooltip = root.style.getPropertyValue("--tooltip-scale");
    root.style.setProperty("--text-scale", String(scale));
    root.style.setProperty("--tooltip-scale", String(tooltipScale));
    return () => {
      if (previousText) root.style.setProperty("--text-scale", previousText);
      else root.style.removeProperty("--text-scale");
      if (previousTooltip) root.style.setProperty("--tooltip-scale", previousTooltip);
      else root.style.removeProperty("--tooltip-scale");
    };
  }, [scale, tooltipScale]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (
        [
          "Tab",
          "Enter",
          " ",
          "Escape",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
          "PageUp",
          "PageDown",
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
      window.clearTimeout(scrollTimer.current);
    };
  }, []);
  const reset = () => {
    setPreferences(freshPreferences());
    setFailed(false);
    setRevision((value) => value + 1);
  };
  const onScroll = () => {
    setScrolling(true);
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => setScrolling(false), 700);
  };
  return (
    <main className="button-study settings-review" data-reduced={reduced}>
      <header className="study-heading">
        <h1>Settings · combined review</h1>
        <p>Your chosen tabs, controls, focus states and transitions in one screen.</p>
      </header>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" ref={openerRef}>
            Open Settings
          </Button>
        </DialogTrigger>
        <DialogContent
          ref={dialogRef}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus(openerRef.current);
          }}
          className="settings-combined"
          data-text-size={scale * 100}
          data-reduced={reduced}
          data-narrow={narrow}
          data-short={short}
          data-scrolling={scrolling}
          onScroll={onScroll}
          closeLabel="Close Settings"
        >
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Combined design preview. Changes apply to this preview only.
          </DialogDescription>
          {failed ? (
            <div className="settings-preview-error" role="alert">
              <AlertTriangle aria-hidden="true" />
              <p>Could not save settings.</p>
              <Button
                variant="outline"
                onClick={() => {
                  dialogRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')?.focus();
                  setFailed(false);
                }}
              >
                Retry
              </Button>
            </div>
          ) : null}
          <Settings
            key={revision}
            session={session}
            preferences={preferences}
            update={update}
            openLanguage={() => setLanguageOpen(true)}
          />
          <Dialog open={languageOpen} onOpenChange={setLanguageOpen}>
            <DialogContent closeLabel="Close Language">
              <DialogTitle>Language</DialogTitle>
              <DialogDescription className="sr-only">Choose a preview language</DialogDescription>
              <LanguageChoices />
            </DialogContent>
          </Dialog>
          <section className="settings-preview-tools" aria-label="Preview tools">
            <h2>Preview tools</h2>
            <div className="preview-toggles">
              <label>
                <Switch checked={reduced} onCheckedChange={setReduced} />
                Reduce motion
              </label>
              <label>
                <Switch checked={narrow} onCheckedChange={setNarrow} />
                Narrow layout
              </label>
              <label>
                <Switch checked={short} onCheckedChange={setShort} />
                Short window
              </label>
            </div>
            <div className="study-navigation">
              <Button variant="outline" onClick={() => setFailed(true)}>
                Simulate save error
              </Button>
              <Button variant="outline" onClick={reset}>
                Reset preview values
              </Button>
              <Tooltip>
                <TooltipTrigger asChild reopenOnPointerMove={false}>
                  <Button variant="outline">Preview tooltip</Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={8}
                  className="settings-preview-tooltip"
                  data-size={tooltipScale * 100}
                  data-reduced={reduced}
                >
                  <KeywordText text={KEYWORD_DEFINITIONS.block.description} />
                </TooltipContent>
              </Tooltip>
            </div>
            <p>
              These tools belong to the study. Values reset on reload. No game settings, saves or audio
              playback are changed.
            </p>
          </section>
        </DialogContent>
      </Dialog>
      <section className="settings-review-guide">
        <h2>Try it together</h2>
        <p>
          Use Tab and Shift+Tab for focus; Left/Right changes tabs and radio choices. Volume sliders use arrow
          keys in 10% steps, plus Home/End. Try focus while hovering, selected radios, sliders while dragging,
          125% text and narrow/short layouts.
        </p>
        <p>Close with Escape, then reopen to check focus return and retained preview values.</p>
        <p>
          Sound levels are visual controls here. Listening, native desktop and physical-controller review
          remain separate.
        </p>
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <LocalizationProvider persist={false}>
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <SettingsReview />
    </TooltipProvider>
  </LocalizationProvider>,
);
