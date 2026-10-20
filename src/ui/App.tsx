import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { Menu } from "lucide-react";
import type { Session } from "../application/session";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { TooltipProvider } from "../components/ui/tooltip";
import { BattleScreen, type Inspection, type Controls } from "./battle-screen";
import {
  Draft,
  TeamSelection,
  Rewards,
  Talents,
  Collection,
  EndScreen,
  DeckCards,
} from "./expedition-screens";
import { Inspector } from "./inspection";
import { connectInput, moveFocus, type InputAction } from "./input";
import { returnFocus } from "./focus";
import { useCombatFeedback } from "./combat-feedback";
import { GLOSSARY } from "../game/glossary";
import type { Command } from "../game/types";
import type { SpeciesId } from "../game/content";
import "./mana-crystals.css";

type Route = "home" | "play" | "talents" | "collection";
type Modal = "settings" | "glossary" | "endRun" | "deck" | null;
export function App(props: { session: Session; desktop?: boolean }) {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
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
    gameControls: Controls = useRef(null);
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
  const paused = route !== "play" || menu || modal !== null || inspection !== null;
  const bursts = useCombatFeedback(session, root, sound, paused);
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
  const openMenu = () => {
    pauseOpener.current = document.activeElement as HTMLElement | null;
    setMenu(true);
  };
  const openModal = (next: Modal) => {
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
    if (action === "inspect" && !inspection && !menu && (!modal || modal === "deck")) {
      const focused = document.activeElement as HTMLElement | null;
      const card = game.cards.find(
        (c) => c.id === focused?.closest<HTMLElement>("[data-card-id]")?.dataset.cardId,
      );
      const kind = focused?.closest<HTMLElement>("[data-species]")?.dataset.species as SpeciesId | undefined;
      if (card) setInspection({ card });
      else if (kind)
        setInspection({
          species: kind,
          enemyId: focused?.closest<HTMLElement>("[data-enemy-id]")?.dataset.enemyId,
        });
      return;
    }
    if (!paused) gameControls.current?.(action);
  };
  const actionRef = useRef(input);
  useEffect(() => {
    actionRef.current = input;
  });
  useEffect(() => connectInput((action) => actionRef.current(action), setMode), []);
  useEffect(() => {
    if (!view.ready || menu || modal || inspection || (route === "play" && mode === "pointer")) return;
    const buttons = Array.from(
      root.current?.querySelectorAll<HTMLElement>("main button:not(:disabled)") ?? [],
    ).filter((el) => el.getClientRects().length > 0);
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
        variant="ghost"
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
        {home ? (active ? "Continue" : "New expedition") : "Resume"}
      </Button>
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
          End run
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
              <TeamSelection
                game={game}
                send={send}
                inspect={setInspection}
                deck={() => openModal("deck")}
                navigateFocus={mode !== "pointer"}
                controls={gameControls}
              />
            ) : game.phase === "battle" ? (
              <BattleScreen
                key={game.encounter}
                game={game}
                send={send}
                inspect={setInspection}
                controls={gameControls}
                bursts={bursts}
                controller={mode === "controller"}
                navigateFocus={mode !== "pointer"}
              />
            ) : game.phase === "reward" || game.phase === "recruit" || game.phase === "relic" ? (
              <Rewards
                key={`${game.encounter}-${game.phase}`}
                game={game}
                send={send}
                inspect={setInspection}
              />
            ) : (
              <EndScreen game={game} send={send} inspect={setInspection} home={() => setRoute("home")} />
            )}
            <div className="sr-only" role="log" aria-live="polite">
              {view.events.map((event) => event.text).join(" ")}
            </div>
          </div>
        </>
      )}
      <Dialog open={menu} onOpenChange={setMenu}>
        <DialogContent
          className="menu-panel"
          closeLabel="Close menu"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (route === "play") returnFocus(pauseOpener.current);
          }}
        >
          <DialogTitle className="sr-only">Pause menu</DialogTitle>
          <DialogDescription className="sr-only">Game menu</DialogDescription>
          {menuItems(false)}
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent
          className={modal === "deck" ? "deck-dialog" : modal === "endRun" ? "confirm-dialog" : "glossary"}
          closeLabel={
            modal === "deck"
              ? "Close deck"
              : modal === "settings"
                ? "Close settings"
                : modal === "glossary"
                  ? "Close glossary"
                  : "Cancel end run"
          }
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus(modalOpener.current);
          }}
        >
          <DialogTitle>
            {modal === "deck"
              ? "Deck"
              : modal === "settings"
                ? "Settings"
                : modal === "glossary"
                  ? "Glossary & controls"
                  : "End expedition?"}
          </DialogTitle>
          <DialogDescription className={modal === "endRun" ? undefined : "sr-only"}>
            {modal === "endRun"
              ? "Return to the main menu? Your expedition team and relics will be lost. Permanent progress is kept."
              : "Game information and controls"}
          </DialogDescription>
          {modal === "deck" ? (
            <DeckCards game={game} inspect={setInspection} />
          ) : modal === "settings" ? (
            <div className="settings-controls">
              <Button
                variant="outline"
                onClick={() => setScale(scale === 1 ? 1.25 : scale === 1.25 ? 1.5 : 1)}
              >
                Text size {scale * 100}%
              </Button>
              <Button variant="outline" aria-pressed={sound} onClick={() => setSound((old) => !old)}>
                Sound {sound ? "on" : "off"}
              </Button>
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
                    <dt>{entry.term}</dt>
                    <dd>{entry.definition}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : modal === "endRun" ? (
            <div className="confirm-actions">
              <Button variant="outline" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (send({ type: "abandon" })) {
                    setModal(null);
                    setMenu(false);
                    setRoute("home");
                  }
                }}
              >
                End run
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {inspection ? (
        <Inspector item={inspection} session={session} onClose={() => setInspection(null)} />
      ) : null}
    </div>
  );
}
