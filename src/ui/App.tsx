import { PagedItems } from "./pagination";
import { captureSwapMotion } from "./swap-motion";
import { SurfaceTransition } from "./surface-transition";
import { Loading } from "./loading";
import { TriangleAlert } from "lucide-react";
import { CloudRecovery } from "./platform-settings";
import { SupportScreen, SupportInspector } from "./support-screen";
import { BOONS } from "../game/progression";
import { ArtCard } from "./art-card";
import { assetUrl } from "./assets";
import { CreatureCard } from "./cards";
import { species } from "../game/content";
import { readPreference, writePreference } from "../platform/preferences";
import { useAutoplay } from "./autoplay";
import { observeUnlocks } from "./unlock-reveals";
import { Campfire } from "./campfire";
import { Settings, TEXT_SCALES } from "./settings";
import { useAudioPreferences } from "./audio-preferences";
import { useGameAudio } from "./game-audio";
import { JourneyResults } from "./journey-results";
import { KeywordText } from "./keyword-text";
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
import {
  Menu,
  ArrowLeftRight,
  Bot,
  Pause,
  Play,
  Compass,
  Trophy,
  Users,
  Sparkles,
  PawPrint,
  Gift,
  BookOpen,
  Settings2,
  Flag,
  House,
  LogOut,
  FastForward,
} from "lucide-react";
import type { Session } from "../application/session";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { TooltipProvider } from "../components/ui/tooltip";
import { BattleScreen, type Inspection, type Controls } from "./battle-screen";
import { Draft, TeamSelection, Rewards, Talents, Collection, DeckCards } from "./expedition-screens";
import { RosterPicker } from "./roster-picker";
import { Inspector } from "./inspection";
import { connectInput, moveFocus, type InputAction } from "./input";
import { isAvailableFocusTarget, returnFocus } from "./focus";
import { useCombatFeedback } from "./combat-feedback";
import { GLOSSARY } from "../game/glossary";
import type { Command } from "../game/types";
import type { SpeciesId } from "../game/content";
import "./mana-crystals.css";

type Route = "home" | "play" | "talents" | "collection" | "settings" | "glossary" | "unlocks";
type Modal = "boons" | "endRun" | "deck" | "swap" | "lineup" | "draw" | "discard" | null;
export function App(props: { session: Session; desktop?: boolean }) {
  return (
    <TooltipProvider>
      <Game {...props} />
    </TooltipProvider>
  );
}
function preference(key: string, fallback: string) {
  return readPreference(key) ?? fallback;
}
function Game({ session, desktop = false }: { session: Session; desktop?: boolean }) {
  const view = useStore(session.store),
    game = view.game;
  const root = useRef<HTMLDivElement>(null),
    gameControls: Controls = useRef(null),
    inspectionControls: Controls = useRef(null),
    talentControls: Controls = useRef(null);
  const [route, setRoute] = useState<Route>("home"),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState<Modal>(null),
    [modalInstance, setModalInstance] = useState(0),
    [inspection, setInspection] = useState<Inspection | null>(null);
  const [mode, setMode] = useState<"pointer" | "keyboard" | "controller">("pointer");
  const [navigation, setNavigation] = useState(false);
  const [audioPreferences, updateAudioPreferences] = useAudioPreferences();
  const playSound = useGameAudio(session, audioPreferences, route === "home");
  useEffect(() => {
    const activate = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>("button") : null;
      if (!button || button.matches(':disabled, [aria-disabled="true"]') || button.closest("[inert]")) return;
      if (
        button.matches(
          ".home-screen button, .menu-panel button, .settings-screen button, .ui-tab, .dialog-close",
        )
      )
        playSound("activate");
    };
    window.addEventListener("click", activate);
    return () => window.removeEventListener("click", activate);
  }, [playSound]);
  const [scale, setScale] = useState(() => {
    const n = Number(preference("fauna.text-scale", "1"));
    return TEXT_SCALES.some((value) => value === n) ? n : 1;
  });
  const [tooltipScale, setTooltipScale] = useState(() => {
    const value = Number(preference("fauna.tooltip-scale", "1"));
    return TEXT_SCALES.some((scale) => scale === value) ? value : 1;
  });
  useEffect(() => {
    document.documentElement.style.setProperty("--tooltip-scale", String(tooltipScale));
    writePreference("fauna.tooltip-scale", String(tooltipScale));
  }, [tooltipScale]);
  const origin = useRef<Route>("home"),
    pauseOpener = useRef<HTMLElement | null>(null),
    modalOpener = useRef<HTMLElement | null>(null);
  const active =
    !["victory", "defeat"].includes(game.phase) && (game.team.length > 0 || game.selected.length > 0);
  const canManageLineup =
    game.phase === "teamSelection" ||
    game.phase === "campfire" ||
    game.phase === "support" ||
    (["recruit", "boon"].includes(game.phase) && game.reward?.outcome === "next");
  const [autoEndTurn, setAutoEndTurn] = useState(() => preference("fauna.auto-end-turn", "true") !== "false");
  const [pendingUnlocks, setPendingUnlocks] = useState<SpeciesId[]>([]);
  const [reveals, setReveals] = useState<SpeciesId[]>([]);
  useEffect(
    () => observeUnlocks(session, (ids) => setPendingUnlocks((old) => [...new Set([...old, ...ids])])),
    [session],
  );
  const paused =
    view.overlayActive ||
    view.cloud.blocking ||
    route !== "play" ||
    menu ||
    modal !== null ||
    inspection !== null;
  const [autoplay, setAutoplay] = useAutoplay(session, paused, autoEndTurn);
  useEffect(() => {
    if (route !== "play") setAutoplay(false);
  }, [route, setAutoplay]);
  const { bursts, deny } = useCombatFeedback(session, root, playSound, paused);
  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", String(scale));
    writePreference("fauna.text-scale", String(scale));
  }, [scale]);
  const swapMotion = useRef<ReturnType<typeof captureSwapMotion> | null>(null);
  useEffect(() => () => swapMotion.current?.cancel(), []);
  const send = useCallback(
    (command: Command) => {
      setAutoplay(false);
      swapMotion.current?.cancel();
      const motion =
        command.type === "swap" || command.type === "setLineup"
          ? captureSwapMotion(command.activeId, command.reserve)
          : null;
      const accepted = session.command(command.type === "play" ? { ...command, autoEndTurn } : command);
      if (accepted) {
        swapMotion.current = motion;
        motion?.start();
      }
      return accepted;
    },
    [session, autoEndTurn, setAutoplay],
  );
  const leaveResults = () => {
    setReveals(pendingUnlocks);
    setPendingUnlocks([]);
    setRoute(pendingUnlocks.length ? "unlocks" : "home");
  };
  const menuReturnLabel = useRef<string | null>(null);
  const openMenu = () => {
    pauseOpener.current = document.activeElement as HTMLElement | null;
    setMenu(true);
  };
  const openModal = (next: Modal) => {
    if (menu) menuReturnLabel.current = document.activeElement?.textContent ?? null;
    modalOpener.current = document.activeElement as HTMLElement | null;
    // Reopening during an exit fade needs a fresh Radix focus scope.
    setModalInstance((instance) => instance + 1);
    setModal(next);
  };
  const navigate = (next: "talents" | "collection" | "settings" | "glossary") => {
    origin.current = menu ? "play" : route;
    // Menu pages unmount their opener; retain its label for the recreated menu.
    menuReturnLabel.current = {
      talents: "Talents",
      collection: "Collection",
      settings: "Settings",
      glossary: "Glossary",
    }[next];
    setMenu(false);
    setRoute(next);
  };
  const backFromPage = () => {
    setRoute(origin.current);
    if (origin.current === "play") setMenu(true);
  };
  useEffect(() => {
    if (!view.cloud.blocking) return;
    setModal(null);
    setInspection(null);
    setMenu(false);
    setAutoplay(false);
  }, [view.cloud.blocking, setAutoplay]);
  useEffect(() => {
    if (!view.overlayActive) return;
    setAutoplay(false);
    if (route === "play") setMenu(true);
  }, [view.overlayActive, route, setAutoplay]);
  const input = (action: InputAction) => {
    if (session.store.getState().overlayActive) return;
    if (session.store.getState().cloud.blocking) {
      if (["left", "right", "up", "down"].includes(action))
        moveFocus(action as "left" | "right" | "up" | "down");
      else if (action === "confirm") {
        const focused = document.activeElement as HTMLElement | null;
        if (isAvailableFocusTarget(focused)) focused.click();
      }
      return;
    }
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
      if (route === "talents" && talentControls.current?.(action)) return;
      if (["talents", "collection", "settings", "glossary"].includes(route)) {
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
      const focused = document.activeElement as HTMLElement | null;
      if (isAvailableFocusTarget(focused)) focused.click();
      return;
    }
    if (
      action === "inspect" &&
      !inspection &&
      (!menu || modal === "lineup") &&
      (!modal || ["deck", "draw", "discard", "swap", "lineup"].includes(modal))
    ) {
      const focused = document.activeElement as HTMLElement | null;
      const card = game.cards.find(
        (c) => c.id === focused?.closest<HTMLElement>("[data-card-id]")?.dataset.cardId,
      );
      const kind = focused?.closest<HTMLElement>("[data-species]")?.dataset.species as SpeciesId | undefined;
      const support = focused?.closest<HTMLElement>("[data-support]")?.dataset.support;
      if (support) setInspection({ support });
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
    const previousFocus = document.documentElement.dataset.focus;
    document.documentElement.dataset.input = root.current?.dataset.input ?? "pointer";
    document.documentElement.dataset.focus = "hidden";
    const disconnect = connectInput(
      (action) => actionRef.current(action),
      (next, navigating) => {
        // Publish mode before native focus/click handlers, including Radix portals.
        if (root.current) root.current.dataset.input = next;
        document.documentElement.dataset.input = next;
        document.documentElement.dataset.focus = navigating ? "visible" : "hidden";
        // Settle focus before a controller confirm in this same input callback.
        flushSync(() => {
          setMode(next);
          setNavigation(navigating);
        });
      },
      () => session.store.getState().overlayActive,
    );
    return () => {
      disconnect();
      if (previous === undefined) delete document.documentElement.dataset.input;
      else document.documentElement.dataset.input = previous;
      if (previousFocus === undefined) delete document.documentElement.dataset.focus;
      else document.documentElement.dataset.focus = previousFocus;
    };
  }, []);
  useLayoutEffect(() => {
    if (!view.ready || menu || modal || inspection || (route === "play" && mode === "pointer")) return;
    const buttons = Array.from(
      root.current?.querySelectorAll<HTMLElement>("main button:not(:disabled)") ?? [],
    ).filter((el) => el.getClientRects().length > 0);
    if (route === "home" && menuReturnLabel.current) {
      const opener = buttons.find((el) => el.textContent === menuReturnLabel.current);
      menuReturnLabel.current = null;
      if (opener) {
        opener.focus();
        return;
      }
    }
    if (route === "settings") {
      root.current
        ?.querySelector<HTMLElement>('.settings-screen [role="tab"][aria-selected="true"]')
        ?.focus();
      return;
    }
    // Screen transitions must not replace focus the player already moved onto the new screen.
    if (buttons.includes(document.activeElement as HTMLElement)) return;
    (buttons.find((el) => el.classList.contains("primary-menu-action")) ?? buttons[0])?.focus();
  }, [
    route,
    game.phase,
    view.ready,
    view.recoveryRequired,
    view.cloud.blocking,
    view.cloud.status,
    view.cloud.importAvailable,
    view.cloud.candidates.length,
  ]);
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
        <Loading />
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
        {home && !active ? (
          <Compass aria-hidden="true" className="menu-icon-journey" />
        ) : (
          <Play aria-hidden="true" className="menu-icon-journey" />
        )}
        {home ? (active ? "Continue" : "New journey") : "Resume"}
      </Button>
      {home && ["victory", "defeat"].includes(game.phase) ? (
        <Button variant="ghost" onClick={() => setRoute("play")}>
          <Trophy aria-hidden="true" className="menu-icon-results" />
          Journey results
        </Button>
      ) : null}
      {canManageLineup ? (
        <Button variant="ghost" onClick={() => openModal("lineup")}>
          <Users aria-hidden="true" className="menu-icon-lineup" />
          Lineup
        </Button>
      ) : null}
      <Button variant="ghost" onClick={() => navigate("talents")}>
        <Sparkles aria-hidden="true" className="menu-icon-talents" />
        Talents
      </Button>
      <Button variant="ghost" onClick={() => navigate("collection")}>
        <PawPrint aria-hidden="true" className="menu-icon-collection" />
        Collection
      </Button>
      {active && game.boons.length > 0 ? (
        <Button variant="ghost" onClick={() => openModal("boons")}>
          <Gift aria-hidden="true" className="menu-icon-boons" />
          Boons
        </Button>
      ) : null}
      <Button variant="ghost" onClick={() => navigate("glossary")}>
        <BookOpen aria-hidden="true" className="menu-icon-glossary" />
        Glossary
      </Button>
      <Button variant="ghost" onClick={() => navigate("settings")}>
        <Settings2 aria-hidden="true" className="menu-icon-settings" />
        Settings
      </Button>
      {active ? (
        <Button variant="ghost" onClick={() => openModal("endRun")}>
          <Flag aria-hidden="true" className="menu-icon-end" />
          End journey
        </Button>
      ) : null}
      {!home ? (
        <Button
          variant="ghost"
          onClick={() => {
            setMenu(false);
            if (["victory", "defeat"].includes(game.phase)) leaveResults();
            else setRoute("home");
          }}
        >
          <House aria-hidden="true" className="menu-icon-home" />
          Main menu
        </Button>
      ) : null}
      {desktop ? (
        <Button variant="ghost" busy={view.closing} onClick={() => void session.quit()}>
          <LogOut aria-hidden="true" className="menu-icon-quit" />
          Save & quit
        </Button>
      ) : null}
    </>
  );
  const overlays = (
    <>
      {" "}
      <Dialog
        key={`modal-${modalInstance}`}
        open={modal !== null && modal !== "endRun"}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent
          className={
            modal === "swap" || modal === "lineup"
              ? "swap-dialog"
              : modal === "deck" || modal === "draw" || modal === "discard" || modal === "boons"
                ? "deck-dialog"
                : ""
          }
          closeLabel={
            modal === "swap"
              ? "Close Swap"
              : modal === "lineup"
                ? "Close Lineup"
                : modal === "draw"
                  ? "Close draw pile"
                  : modal === "discard"
                    ? "Close discard pile"
                    : modal === "deck"
                      ? "Close deck"
                      : modal === "boons"
                        ? "Close Boons"
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
                : modal === "draw"
                  ? "Draw Pile"
                  : modal === "discard"
                    ? "Discard Pile"
                    : modal === "deck"
                      ? "Deck"
                      : modal === "boons"
                        ? "Boons"
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
          ) : modal === "deck" || modal === "draw" || modal === "discard" ? (
            <DeckCards game={game} inspect={setInspection} pile={modal === "deck" ? undefined : modal} />
          ) : modal === "boons" ? (
            <PagedItems items={game.boons} pageSize={2} className="boon-options" label="Boon pages">
              {(id) => {
                const boon = BOONS.find((entry) => entry.id === id)!;
                return (
                  <section className="reward-option" key={id}>
                    <ArtCard
                      aspect="action"
                      artwork={assetUrl(`boon.${id}`)}
                      presentation
                      aria-label={boon.name}
                    />
                    <h2>{boon.name}</h2>
                    <p>
                      <KeywordText text={boon.text} />
                    </p>
                  </section>
                );
              }}
            </PagedItems>
          ) : null}
          {inspection && !("support" in inspection) ? (
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
        key={`confirmation-${modalInstance}`}
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
              : "Finish this journey and view your results? Your team and boons will not carry into the next journey. Permanent progress is kept."}
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
        "support" in inspection ? (
          <SupportInspector game={game} send={send} close={() => setInspection(null)} />
        ) : (
          <Inspector
            item={inspection}
            session={session}
            controls={inspectionControls}
            onClose={() => setInspection(null)}
            chooseStarter={
              route === "play" &&
              game.phase === "draft" &&
              !menu &&
              "species" in inspection &&
              game.starterOffers.includes(inspection.species)
                ? () => send({ type: "draft", species: inspection.species })
                : undefined
            }
          />
        )
      ) : null}
    </>
  );
  return (
    <SurfaceTransition token={`${route}:${game.phase}`} battle={route === "play" && game.phase === "battle"}>
      <div
        ref={root}
        className={`app ${route === "play" && game.phase === "battle" ? "in-battle" : ""}`}
        data-input={mode}
        data-focus={navigation ? "visible" : "hidden"}
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
            <TriangleAlert className="error-icon" aria-hidden="true" />
            {view.error}
            {view.saveStatus === "error" ? (
              <Button variant="outline" onClick={() => session.retrySave()}>
                Retry save
              </Button>
            ) : null}
          </div>
        ) : null}
        {view.cloud.blocking ? (
          <CloudRecovery session={session} />
        ) : view.loadFailed || view.recoveryRequired ? (
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
            {route === "unlocks" && reveals[0] ? (
              <main className="unlock-screen">
                <h1>Creature unlocked</h1>
                <div className="unlock-creature">
                  <CreatureCard
                    progression={game}
                    kind={reveals[0]}
                    label={`Inspect ${species(reveals[0]).name}`}
                    onClick={() => setInspection({ species: reveals[0]! })}
                    onInspect={() => setInspection({ species: reveals[0]! })}
                  />
                  <h2>{species(reveals[0]).name}</h2>
                </div>
                <Button
                  onClick={() => {
                    setReveals((old) => old.slice(1));
                    if (reveals.length === 1) setRoute("home");
                  }}
                >
                  Continue
                </Button>
              </main>
            ) : null}
            {route === "talents" ? (
              <Talents game={game} send={send} openMenu={backFromPage} controls={talentControls} />
            ) : null}
            {route === "collection" ? (
              <Collection game={game} inspect={setInspection} openMenu={backFromPage} />
            ) : null}
            {route === "settings" || route === "glossary" ? (
              <main className={`menu-screen ${route}-screen`} aria-labelledby="menu-screen-title">
                <header className="collection-heading">
                  <h1 id="menu-screen-title">{route === "settings" ? "Settings" : "Glossary & controls"}</h1>
                  <Button variant="ghost" size="icon" aria-label="Open menu" onClick={backFromPage}>
                    <Menu aria-hidden="true" />
                  </Button>
                </header>
                {route === "settings" ? (
                  <Settings
                    session={session}
                    audio={audioPreferences}
                    updateAudio={updateAudioPreferences}
                    scale={scale}
                    setScale={setScale}
                    tooltipScale={tooltipScale}
                    setTooltipScale={setTooltipScale}
                    desktop={desktop}
                    autoEndTurn={autoEndTurn}
                    setAutoEndTurn={(value) => {
                      setAutoEndTurn(value);
                      writePreference("fauna.auto-end-turn", String(value));
                    }}
                  />
                ) : (
                  <>
                    <p>
                      W/A/S/D or Tab to navigate. A/D switches targets. Enter/controller A selects. Escape/B
                      goes back. I/controller X inspects. Controller Y ends the turn.
                    </p>
                    <PagedItems
                      items={GLOSSARY}
                      pageSize={scale > 1 ? 2 : 3}
                      className="glossary-entries"
                      label="Glossary pages"
                    >
                      {(entry) => (
                        <dl key={entry.term}>
                          <dt>
                            <KeywordText text={entry.term} />
                          </dt>
                          <dd>
                            <KeywordText text={entry.definition} />
                          </dd>
                        </dl>
                      )}
                    </PagedItems>
                  </>
                )}
              </main>
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
              {game.phase === "battle" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="autoplay-control"
                  aria-label="Auto-play"
                  aria-pressed={autoplay}
                  onClick={() => setAutoplay(!autoplay)}
                >
                  {autoplay ? <Pause aria-hidden="true" /> : <Bot aria-hidden="true" />}
                </Button>
              ) : null}
              {game.phase === "draft" ? (
                <Draft game={game} send={send} inspect={setInspection} />
              ) : game.phase === "teamSelection" ? (
                <TeamSelection
                  game={game}
                  send={send}
                  inspect={setInspection}
                  deck={() => openModal("deck")}
                />
              ) : game.phase === "support" ? (
                <SupportScreen game={game} send={send} />
              ) : game.phase === "campfire" ? (
                <Campfire game={game} send={send} />
              ) : game.phase === "battle" ? (
                <BattleScreen
                  key={game.encounter}
                  clearSelection={
                    view.overlayActive || menu || modal !== null || inspection !== null || autoplay
                  }
                  onManualStart={() => setAutoplay(false)}
                  openPile={(pile) => openModal(pile)}
                  actions={
                    <>
                      <Button
                        variant="outline"
                        className="swap-trigger"
                        disabled={!game.reserves.some((c) => c.health > 0)}
                        onClick={() => openModal("swap")}
                      >
                        <ArrowLeftRight aria-hidden="true" />
                        Swap
                      </Button>
                    </>
                  }
                  game={game}
                  send={send}
                  inspect={setInspection}
                  controls={gameControls}
                  bursts={bursts}
                  onDenied={deny}
                  controller={mode === "controller"}
                  navigateFocus={navigation}
                />
              ) : game.phase === "recruit" || game.phase === "boon" ? (
                <Rewards
                  key={`${game.encounter}-${game.phase}`}
                  game={game}
                  send={send}
                  inspect={setInspection}
                />
              ) : (
                <JourneyResults game={game} home={leaveResults} />
              )}
              <div className="sr-only" role="log" aria-live="polite">
                {view.events.map((event) => event.text).join(" ")}
              </div>
            </div>
          </>
        )}
        {!modal && !inspection ? (
          <Dialog open={menu} onOpenChange={setMenu}>
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
                if (modal || inspection) return;
                if (route === "play") returnFocus(pauseOpener.current);
                else if (route === "settings")
                  returnFocus(
                    root.current?.querySelector<HTMLElement>(
                      '.settings-screen [role="tab"][aria-selected="true"]',
                    ) ?? null,
                  );
                else
                  returnFocus(root.current?.querySelector<HTMLElement>("main button:not(:disabled)") ?? null);
              }}
            >
              <DialogTitle className="sr-only">Pause menu</DialogTitle>
              <DialogDescription className="sr-only">Game menu</DialogDescription>
              {menuItems(false)}
              {import.meta.env.DEV && game.phase === "battle" ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (send({ type: "devWinBattle" })) setMenu(false);
                  }}
                >
                  <FastForward aria-hidden="true" className="menu-icon-skip" />
                  Skip combat
                </Button>
              ) : null}
            </DialogContent>
          </Dialog>
        ) : null}
        {overlays}
      </div>
    </SurfaceTransition>
  );
}
