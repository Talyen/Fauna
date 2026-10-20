import { JourneyResults } from "./journey-results";
import { KeywordText } from "./keyword-text";
import { Switch } from "../components/ui/switch";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "../components/ui/alert-dialog";
import { buttonVariants } from "../components/ui/button";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { flushSync } from "react-dom";
import { Menu, ArrowLeftRight } from "lucide-react";
import type { Session } from "../application/session";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { TooltipProvider } from "../components/ui/tooltip";
import { BattleScreen, type Inspection, type Controls } from "./battle-screen";
import { Draft, TeamSelection, Rewards, Talents, Collection, DeckCards } from "./expedition-screens";
import { RosterPicker } from "./roster-picker";
import { Inspector } from "./inspection";
import { connectInput, moveFocus, type InputAction } from "./input";
import { returnFocus } from "./focus";
import { useCombatFeedback } from "./combat-feedback";
import { GLOSSARY } from "../game/glossary";
import type { Command } from "../game/types";
import type { SpeciesId } from "../game/content";
import "./mana-crystals.css";

type Route = "home" | "play" | "talents" | "collection";
type Modal = "settings" | "glossary" | "endRun" | "deck" | "swap" | "lineup" | null;
export function App(props: { session: Session; desktop?: boolean }) {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100} disableHoverableContent>
      <Game {...props} />
    </TooltipProvider>
  );
}
function preference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function Game({ session, desktop = false }: { session: Session; desktop?: boolean }) {
  const view = useStore(session.store),
    game = view.game;
  const root = useRef<HTMLDivElement>(null),
    gameControls: Controls = useRef(null),
    inspectionControls: Controls = useRef(null);
  const [route, setRoute] = useState<Route>("home"),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState<Modal>(null),
    [inspection, setInspection] = useState<Inspection | null>(null);
  const [mode, setMode] = useState<"pointer" | "keyboard" | "controller">("pointer");
  const [sound, setSound] = useState(() => preference("fauna.sound.enabled", "true") !== "false");
  const [scale, setScale] = useState(() => {
    const n = Number(preference("fauna.text-scale", "1"));
    return [1, 1.25, 1.5].includes(n) ? n : 1;
  });
  const origin = useRef<Route>("home"),
    pauseOpener = useRef<HTMLElement | null>(null),
    modalOpener = useRef<HTMLElement | null>(null);
  const active =
    !["victory", "defeat"].includes(game.phase) && (game.team.length > 0 || game.selected.length > 0);
  const canManageLineup =
    game.phase === "teamSelection" ||
    (["recruit", "relic"].includes(game.phase) && game.reward?.outcome === "next");
  const paused = route !== "play" || menu || modal !== null || inspection !== null;
  const { bursts, deny } = useCombatFeedback(session, root, sound, paused);
  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", String(scale));
    try {
      localStorage.setItem("fauna.text-scale", String(scale));
      localStorage.setItem("fauna.sound.enabled", String(sound));
    } catch {
      /* Optional preferences. */
    }
  }, [scale, sound]);
  const send = useCallback((command: Command) => session.command(command), [session]);
  const menuReturnLabel = useRef<string | null>(null);
  const openMenu = () => {
    pauseOpener.current = document.activeElement as HTMLElement | null;
    setMenu(true);
  };
  const openModal = (next: Modal) => {
    if (menu) menuReturnLabel.current = document.activeElement?.textContent ?? null;
    modalOpener.current = document.activeElement as HTMLElement | null;
    setModal(next);
  };
  const navigate = (next: Route) => {
    origin.current = menu ? "play" : route;
    setMenu(false);
    setRoute(next);
  };
  const backFromPage = () => {
    setRoute(origin.current);
    if (origin.current === "play") setMenu(true);
  };
  const input = (action: InputAction) => {
    if (inspection && inspectionControls.current?.(action)) return;
    if (action === "back") {
      if (inspection) {
        setInspection(null);
        return;
      }
      if (modal) {
        setModal(null);
        return;
      }
      if (menu) {
        setMenu(false);
        return;
      }
      if (route === "talents" || route === "collection") {
        backFromPage();
        return;
      }
      if (route === "play") {
        if (!gameControls.current?.(action)) openMenu();
      }
      return;
    }
    if (["left", "right", "up", "down"].includes(action)) {
      if (!paused && gameControls.current?.(action)) return;
      moveFocus(action as "left" | "right" | "up" | "down");
      return;
    }
    if (action === "confirm") {
      (document.activeElement as HTMLElement | null)?.click();
      return;
    }
    if (
      action === "inspect" &&
      !inspection &&
      (!menu || modal === "lineup") &&
      (!modal || ["deck", "swap", "lineup"].includes(modal))
    ) {
      const focused = document.activeElement as HTMLElement | null;
      const card = game.cards.find(
        (c) => c.id === focused?.closest<HTMLElement>("[data-card-id]")?.dataset.cardId,
      );
      const kind = focused?.closest<HTMLElement>("[data-species]")?.dataset.species as SpeciesId | undefined;
      const destination = focused?.closest<HTMLElement>("[data-destination]")?.dataset.destination;
      if (destination) setInspection({ destination });
      else if (card) setInspection({ card });
      else if (kind)
        setInspection({
          species: kind,
          enemyId: focused?.closest<HTMLElement>("[data-enemy-id]")?.dataset.enemyId,
          creatureId: focused?.closest<HTMLElement>("[data-actor-id]")?.dataset.actorId,
        });
      return;
    }
    if (!paused) gameControls.current?.(action);
  };
  const actionRef = useRef(input);
  useEffect(() => {
    actionRef.current = input;
  });
  useEffect(() => {
    const previous = document.documentElement.dataset.input;
    document.documentElement.dataset.input = root.current?.dataset.input ?? "pointer";
    const disconnect = connectInput(
      (action) => actionRef.current(action),
      (next) => {
        // Publish mode before native focus/click handlers, including Radix portals.
        if (root.current) root.current.dataset.input = next;
        document.documentElement.dataset.input = next;
        // Settle focus before a controller confirm in this same input callback.
        flushSync(() => setMode(next));
      },
    );
    return () => {
      disconnect();
      if (previous === undefined) delete document.documentElement.dataset.input;
      else document.documentElement.dataset.input = previous;
    };
  }, []);
  useLayoutEffect(() => {
    if (!view.ready || menu || modal || inspection || (route === "play" && mode === "pointer")) return;
    const buttons = Array.from(
      root.current?.querySelectorAll<HTMLElement>("main button:not(:disabled)") ?? [],
    ).filter((el) => el.getClientRects().length > 0);
    // Screen transitions must not replace focus the player already moved onto the new screen.
    if (buttons.includes(document.activeElement as HTMLElement)) return;
    (buttons.find((el) => el.classList.contains("primary-menu-action")) ?? buttons[0])?.focus();
  }, [route, game.phase, view.ready, view.recoveryRequired]);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (session.store.getState().saveStatus !== "saved") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [session]);
  if (!view.ready)
    return (
      <div className="loading" role="status">
        Loading…
      </div>
    );
  const menuItems = (home: boolean) => (
    <>
      <Button
        variant="default"
        className="primary-menu-action"
        onClick={() => {
          if (!home || active) {
            setRoute("play");
            setMenu(false);
          } else if (send({ type: "newRun", seed: Date.now() >>> 0 })) {
            setRoute("play");
            setMenu(false);
          }
        }}
      >
        {home ? (active ? "Continue" : "New journey") : "Resume"}
      </Button>
      {home && ["victory", "defeat"].includes(game.phase) ? (
        <Button variant="ghost" onClick={() => setRoute("play")}>
          Journey results
        </Button>
      ) : null}
      {canManageLineup ? (
        <Button variant="ghost" onClick={() => openModal("lineup")}>
          Lineup
        </Button>
      ) : null}
      <Button variant="ghost" onClick={() => navigate("talents")}>
        Talents
      </Button>
      <Button variant="ghost" onClick={() => navigate("collection")}>
        Collection
      </Button>
      <Button variant="ghost" onClick={() => openModal("glossary")}>
        Glossary
      </Button>
      <Button variant="ghost" onClick={() => openModal("settings")}>
        Settings
      </Button>
      {active ? (
        <Button variant="ghost" onClick={() => openModal("endRun")}>
          End journey
        </Button>
      ) : null}
      {!home ? (
        <Button
          variant="ghost"
          onClick={() => {
            setMenu(false);
            setRoute("home");
          }}
        >
          Main menu
        </Button>
      ) : null}
      {desktop ? (
        <Button variant="ghost" onClick={() => void session.quit()}>
          Save & quit
        </Button>
      ) : null}
    </>
  );
  const overlays = (
    <>
      {" "}
      <Dialog
        open={modal !== null && modal !== "endRun"}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent
          className={
            modal === "swap" || modal === "lineup"
              ? "swap-dialog"
              : modal === "deck"
                ? "deck-dialog"
                : modal === "settings"
                  ? "settings-dialog"
                  : "glossary"
          }
          closeLabel={
            modal === "swap"
              ? "Close Swap"
              : modal === "lineup"
                ? "Close Lineup"
                : modal === "deck"
                  ? "Close deck"
                  : modal === "settings"
                    ? "Close settings"
                    : modal === "glossary"
                      ? "Close glossary"
                      : "Close dialog"
          }
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!menu) returnFocus(modalOpener.current);
          }}
        >
          <DialogTitle>
            {modal === "swap"
              ? "Swap"
              : modal === "lineup"
                ? "Lineup"
                : modal === "deck"
                  ? "Deck"
                  : modal === "settings"
                    ? "Settings"
                    : modal === "glossary"
                      ? "Glossary & controls"
                      : ""}
          </DialogTitle>
          <DialogDescription className="sr-only">Game information and controls</DialogDescription>
          {modal === "swap" || modal === "lineup" ? (
            <RosterPicker
              key={modal}
              game={game}
              lineup={modal === "lineup"}
              send={send}
              inspect={setInspection}
              close={() => setModal(null)}
            />
          ) : modal === "deck" ? (
            <DeckCards game={game} inspect={setInspection} />
          ) : modal === "settings" ? (
            <div className="settings-controls">
              <label className="setting-row" htmlFor="sound-setting">
                <span>Sound</span>
                <Switch id="sound-setting" checked={sound} onCheckedChange={setSound} />
              </label>
              <fieldset>
                <legend>Text size</legend>
                <RadioGroup
                  orientation="vertical"
                  aria-label="Text size"
                  value={String(scale)}
                  onValueChange={(value) => setScale(Number(value))}
                >
                  {[1, 1.25, 1.5].map((value) => (
                    <label className="setting-row" key={value}>
                      <span>{value * 100}%</span>
                      <RadioGroupItem value={String(value)} aria-label={`${value * 100}%`} />
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>
            </div>
          ) : modal === "glossary" ? (
            <>
              <p>
                W/A/S/D or Tab to navigate. A/D switches targets. Enter/controller A selects. Escape/B goes
                back. I/controller X inspects. Controller Y ends the turn.
              </p>
              <dl>
                {GLOSSARY.map((entry) => (
                  <div key={entry.term}>
                    <dt>
                      <KeywordText text={entry.term} />
                    </dt>
                    <dd>
                      <KeywordText text={entry.definition} />
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          {inspection ? (
            <Inspector
              item={inspection}
              session={session}
              controls={inspectionControls}
              onClose={() => setInspection(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={modal === "endRun"}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <AlertDialogContent
          className="confirm-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!menu) returnFocus(modalOpener.current);
          }}
        >
          <AlertDialogTitle>End journey?</AlertDialogTitle>
          <AlertDialogDescription>
            {game.phase === "draft"
              ? "Clear your starter choice and return to the main menu?"
              : "Finish this journey and view your results? Your team and relics will not carry into the next journey. Permanent progress is kept."}
          </AlertDialogDescription>
          <div className="confirm-actions">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={(event) => {
                if (send({ type: "abandon" })) {
                  menuReturnLabel.current = null;
                  setMenu(false);
                  setRoute(game.phase === "draft" ? "home" : "play");
                } else event.preventDefault();
              }}
            >
              End journey
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      {!modal && inspection ? (
        <Inspector
          item={inspection}
          session={session}
          controls={inspectionControls}
          onClose={() => setInspection(null)}
          enterDestination={(destination) => send({ type: "beginBattle", destination })}
          chooseStarter={
            route === "play" && game.phase === "draft" && !menu && "species" in inspection
              ? () => send({ type: "draft", species: inspection.species })
              : undefined
          }
        />
      ) : null}
    </>
  );
  return (
    <div
      ref={root}
      className={`app ${route === "play" && game.phase === "battle" ? "in-battle" : ""}`}
      data-input={mode}
      data-route={route}
      data-phase={game.phase}
      data-save-status={view.saveStatus}
    >
      {view.notice && !view.recoveryRequired ? (
        <p className="notice" role="status">
          {view.notice}
        </p>
      ) : null}
      {view.error && !view.loadFailed ? (
        <div className="error-banner" role="alert">
          {view.error}
          {view.saveStatus === "error" ? (
            <Button variant="outline" onClick={() => session.retrySave()}>
              Retry save
            </Button>
          ) : null}
        </div>
      ) : null}
      {view.loadFailed || view.recoveryRequired ? (
        <main className="recovery">
          <h1>Save unavailable</h1>
          <p>{view.loadFailed ? view.error : view.notice}</p>
          <Button onClick={() => (view.loadFailed ? void session.load() : session.startFresh())}>
            {view.loadFailed ? "Retry loading" : "Start fresh"}
          </Button>
        </main>
      ) : (
        <>
          {route === "home" ? (
            <main className="home-screen">
              <h1>Fauna</h1>
              <nav aria-label="Main menu">{menuItems(true)}</nav>
            </main>
          ) : null}
          {route === "talents" ? <Talents game={game} send={send} back={backFromPage} /> : null}
          {route === "collection" ? (
            <Collection game={game} inspect={setInspection} back={backFromPage} />
          ) : null}
          <div className="play-surface" hidden={route !== "play"} inert={route !== "play"}>
            <Button
              variant="ghost"
              size="icon"
              className="menu-button"
              aria-label="Open menu"
              onClick={openMenu}
            >
              <Menu aria-hidden="true" />
            </Button>
            {game.phase === "draft" ? (
              <Draft game={game} send={send} inspect={setInspection} />
            ) : game.phase === "teamSelection" ? (
              <TeamSelection game={game} send={send} inspect={setInspection} deck={() => openModal("deck")} />
            ) : game.phase === "battle" ? (
              <BattleScreen
                key={game.encounter}
                clearSelection={modal === "swap"}
                actions={
                  <Button
                    variant="outline"
                    className="swap-trigger"
                    disabled={!game.reserves.some((c) => c.health > 0)}
                    onClick={() => openModal("swap")}
                  >
                    <ArrowLeftRight aria-hidden="true" />
                    Swap
                  </Button>
                }
                game={game}
                send={send}
                inspect={setInspection}
                controls={gameControls}
                bursts={bursts}
                onDenied={deny}
                controller={mode === "controller"}
                navigateFocus={mode !== "pointer"}
              />
            ) : game.phase === "recruit" || game.phase === "relic" ? (
              <Rewards
                key={`${game.encounter}-${game.phase}`}
                game={game}
                send={send}
                inspect={setInspection}
              />
            ) : (
              <JourneyResults game={game} home={() => setRoute("home")} />
            )}
            <div className="sr-only" role="log" aria-live="polite">
              {view.events.map((event) => event.text).join(" ")}
            </div>
          </div>
        </>
      )}
      <Dialog open={menu && !modal && !inspection} onOpenChange={setMenu}>
        <DialogContent
          className="menu-panel"
          closeLabel="Close menu"
          onOpenAutoFocus={(event) => {
            const label = menuReturnLabel.current;
            if (!label) return;
            menuReturnLabel.current = null;
            const opener = Array.from(
              (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button"),
            ).find((button) => button.textContent === label);
            if (opener) {
              event.preventDefault();
              opener.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!modal && !inspection && route === "play") returnFocus(pauseOpener.current);
          }}
        >
          <DialogTitle className="sr-only">Pause menu</DialogTitle>
          <DialogDescription className="sr-only">Game menu</DialogDescription>
          {menuItems(false)}
        </DialogContent>
      </Dialog>
      {overlays}
    </div>
  );
}
