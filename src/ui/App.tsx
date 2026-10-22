import { UnlockScreen } from "./expedition/unlock-screen";
import { HomeScreen } from "./menu/home-screen";
import { GlossaryScreen } from "./menu/glossary-screen";
import { MenuActions, type MenuPage } from "./menu/menu-actions";
import { OwnedBoons } from "./expedition/owned-boons";
import { Screen, ScreenHeading, HeaderNavigation } from "./shared/screen";
import { captureSwapMotion } from "./battle/swap-motion";
import { SurfaceTransition } from "./shared/surface-transition";
import { Loading } from "./shared/loading";
import { SupportScreen } from "./expedition/support-screen";
import { KEYWORDS, availablePoints } from "../game/progression";
import { readPreference, writePreference } from "../platform/preferences";
import { useAutoplay } from "./battle/autoplay";
import { observeUnlocks } from "./expedition/unlock-reveals";
import { Campfire } from "./expedition/campfire";
import { Settings, TEXT_SCALES } from "./settings/settings";
import { useAudioPreferences } from "./settings/audio-preferences";
import { useGameAudio } from "./audio/game-audio";
import { JourneyResults } from "./expedition/journey-results";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { flushSync } from "react-dom";
import { Menu, ArrowLeftRight, Repeat, Pause, FastForward } from "lucide-react";
import type { Session } from "../application/session";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent } from "../components/ui/popover";
import { TooltipProvider } from "../components/ui/tooltip";
import { BattleScreen } from "./battle/battle-screen";
import type { Inspection } from "./shared/inspection-model";
import type { Controls } from "./shared/input";
import { Draft } from "./expedition/draft";
import { TeamSelection } from "./expedition/team-selection";
import { Rewards } from "./expedition/rewards";
import { Talents } from "./talents/talents";
import { Collection } from "./collection/collection";
import { DeckCards } from "./shared/deck-cards";
import { RosterPicker } from "./shared/roster-picker";
import { Inspector } from "./inspection/inspection";
import { connectInput, moveFocus, type InputAction } from "./shared/input";
import { isAvailableFocusTarget, returnFocus } from "./shared/focus";
import { useCombatFeedback } from "./battle/combat-feedback";
import type { Command } from "../game/types";
import type { SpeciesId } from "../game/content";
import "./battle/mana-crystals.css";
type Route = "home" | "play" | "talents" | "collection" | "settings" | "glossary" | "unlocks";
type Modal = "boons" | "deck" | "swap" | "lineup" | "draw" | "discard" | null;
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
  const talentPoints = KEYWORDS.reduce((total, keyword) => total + availablePoints(game, keyword), 0);
  const root = useRef<HTMLDivElement>(null),
    gameControls: Controls = useRef(null),
    inspectionControls: Controls = useRef(null),
    talentControls: Controls = useRef(null),
    collectionControls: Controls = useRef(null);
  const [draftStarted, setDraftStarted] = useState(false);
  const [route, setRoute] = useState<Route>("home"),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState<Modal>(null),
    [modalInstance, setModalInstance] = useState(0),
    [menuInstance, setMenuInstance] = useState(0),
    [inspection, setInspection] = useState<Inspection | null>(null);
  const menuGeneration = useRef(0);
  const showMenu = useCallback(() => {
    // Reopening during an exit fade needs a fresh focus scope and revokes the old return callback.
    setMenuInstance(++menuGeneration.current);
    setMenu(true);
  }, []);
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
    !["victory", "defeat"].includes(game.phase) &&
    (game.team.length > 0 || game.selected.length > 0 || (game.phase === "draft" && draftStarted));
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
    const remaining = [...new Set([...reveals, ...pendingUnlocks])];
    setReveals(remaining);
    setPendingUnlocks([]);
    setRoute(remaining.length ? "unlocks" : "home");
  };
  const menuReturnLabel = useRef<string | null>(null);
  const menuAnchor = useRef({
    getBoundingClientRect: () =>
      root.current
        ?.querySelector<HTMLButtonElement>('.play-surface button[aria-label="Open menu"]')
        ?.getBoundingClientRect() ?? new DOMRect(),
  });
  const openMenu = () => {
    pauseOpener.current = document.activeElement as HTMLElement | null;
    showMenu();
  };
  const openModal = (next: Modal) => {
    if (menu) menuReturnLabel.current = document.activeElement?.textContent ?? null;
    modalOpener.current = document.activeElement as HTMLElement | null;
    // Reopening during an exit fade needs a fresh Radix focus scope.
    setModalInstance((instance) => instance + 1);
    setModal(next);
  };
  const navigate = (next: MenuPage) => {
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
    if (origin.current === "play") showMenu();
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
    if (route === "play") showMenu();
  }, [view.overlayActive, route, setAutoplay, showMenu]);
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
    if (route === "collection" && collectionControls.current?.(action)) return;
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
      route !== "collection" &&
      !(route === "play" && game.phase === "battle") &&
      (!menu || modal === "lineup") &&
      (!modal || ["deck", "draw", "discard", "swap", "lineup"].includes(modal))
    ) {
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
      const opener = buttons.find(
        (el) => (el.getAttribute("aria-label") ?? el.textContent) === menuReturnLabel.current,
      );
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
  }, [route, game.phase, view.ready, view.cloud.blocking, view.cloud.status]);
  if (!view.ready)
    return (
      <Screen className="loading">
        <Loading />
      </Screen>
    );
  const menuItems = (home: boolean) => (
    <MenuActions
      home={home}
      active={active}
      canManageLineup={canManageLineup}
      hasBoons={game.boons.length > 0}
      talentPoints={talentPoints}
      desktop={desktop}
      closing={view.closing}
      onContinue={() => {
        if (!home || active) {
          setRoute("play");
          setMenu(false);
        } else if (send({ type: "newRun", seed: Date.now() >>> 0 })) {
          setDraftStarted(true);
          setRoute("play");
          setMenu(false);
        }
      }}
      onLineup={() => openModal("lineup")}
      onBoons={() => openModal("boons")}
      onNavigate={navigate}
      onEndJourney={() => {
        if (send({ type: "abandon" })) {
          menuReturnLabel.current = null;
          setDraftStarted(false);
          setMenu(false);
          setRoute(game.phase === "draft" ? "home" : "play");
        }
      }}
      onHome={() => {
        setMenu(false);
        if (["victory", "defeat"].includes(game.phase)) leaveResults();
        else setRoute("home");
      }}
      onQuit={() => void session.quit()}
    />
  );
  const overlays = (
    <>
      {" "}
      <Dialog
        key={`modal-${modalInstance}`}
        open={modal !== null}
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
              inspect={modal === "lineup" ? setInspection : undefined}
              close={() => setModal(null)}
            />
          ) : modal === "deck" || modal === "draw" || modal === "discard" ? (
            <DeckCards
              game={game}
              inspect={game.phase === "battle" ? undefined : setInspection}
              pile={modal === "deck" ? undefined : modal}
            />
          ) : modal === "boons" ? (
            <OwnedBoons boons={game.boons} />
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
      {!modal && inspection ? (
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
      ) : null}
    </>
  );
  return (
    <SurfaceTransition token={`${route}:${game.phase}`} battle={route === "play" && game.phase === "battle"}>
      <Popover modal open={menu && !modal && !inspection} onOpenChange={setMenu}>
        <PopoverAnchor virtualRef={menuAnchor} />
        <div
          ref={root}
          className={`app ${route === "play" && game.phase === "battle" ? "in-battle" : ""}`}
          data-input={mode}
          data-focus={navigation ? "visible" : "hidden"}
          data-route={route}
          data-phase={game.phase}
          data-save-status={view.saveStatus}
        >
          {!view.cloud.blocking ? (
            <>
              {route === "home" ? <HomeScreen>{menuItems(true)}</HomeScreen> : null}
              {route === "unlocks" && reveals[0] ? (
                <UnlockScreen
                  game={game}
                  kind={reveals[0]}
                  inspect={setInspection}
                  onHome={() => setRoute("home")}
                  onContinue={() => {
                    setReveals((old) => old.slice(1));
                    if (reveals.length === 1) setRoute("home");
                  }}
                />
              ) : null}
              {route === "talents" ? (
                <Talents game={game} send={send} openMenu={backFromPage} controls={talentControls} />
              ) : null}
              {route === "collection" ? (
                <Collection game={game} controls={collectionControls} openMenu={backFromPage} />
              ) : null}
              {route === "glossary" ? <GlossaryScreen scale={scale} back={backFromPage} /> : null}
              {route === "settings" ? (
                <Screen className="menu-screen settings-screen" aria-labelledby="menu-screen-title">
                  <header className="collection-heading">
                    <ScreenHeading id="menu-screen-title" back={backFromPage} openMenu={backFromPage}>
                      Settings
                    </ScreenHeading>
                  </header>
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
                </Screen>
              ) : null}
              <div className="play-surface" hidden={route !== "play"} inert={route !== "play"}>
                <HeaderNavigation.Provider
                  value={{
                    back: () => setRoute("home"),
                    openMenu,
                    deck: ["draft", "teamSelection", "recruit", "boon", "support", "campfire"].includes(
                      game.phase,
                    )
                      ? () => openModal("deck")
                      : undefined,
                  }}
                >
                  {game.phase === "battle" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="menu-button compact-icon-control"
                      aria-label="Open menu"
                      onClick={openMenu}
                    >
                      <Menu aria-hidden="true" />
                    </Button>
                  ) : null}
                  {import.meta.env.DEV && game.phase === "battle" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="skip-combat-control compact-icon-control"
                      aria-label="Skip combat"
                      onClick={() => send({ type: "devWinBattle" })}
                    >
                      <FastForward aria-hidden="true" className="menu-icon-skip" />
                    </Button>
                  ) : null}
                  {game.phase === "battle" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="autoplay-control compact-icon-control"
                      aria-label="Auto-play"
                      aria-pressed={autoplay}
                      onClick={() => setAutoplay(!autoplay)}
                    >
                      {autoplay ? <Pause aria-hidden="true" /> : <Repeat aria-hidden="true" />}
                    </Button>
                  ) : null}
                  {game.phase === "draft" ? (
                    <Draft game={game} send={send} inspect={setInspection} />
                  ) : game.phase === "teamSelection" ? (
                    <TeamSelection
                      game={game}
                      send={send}
                      inspect={setInspection}
                      recovery={view.committedCommand?.type === "rest" ? view.events : undefined}
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
                      openingDraw={view.committedCommand?.type === "beginBattle"}
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
                </HeaderNavigation.Provider>
                <div className="sr-only" role="log" aria-live="polite">
                  {view.events.map((event) => event.text).join(" ")}
                </div>
              </div>
            </>
          ) : (
            <Loading />
          )}
          {!modal && !inspection ? (
            <PopoverContent
              key={menuInstance}
              className="menu-panel"
              aria-label="Pause menu"
              onOpenAutoFocus={(event) => {
                const label = menuReturnLabel.current;
                if (!label) return;
                menuReturnLabel.current = null;
                const opener = Array.from(
                  (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button"),
                ).find((button) => (button.getAttribute("aria-label") ?? button.textContent) === label);
                if (opener) {
                  event.preventDefault();
                  opener.focus();
                }
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (menuGeneration.current !== menuInstance || modal || inspection) return;
                if (route === "play") returnFocus(pauseOpener.current);
                else {
                  // A page may already have focused a deeper destination during the exit fade.
                  const focused = document.activeElement as HTMLElement | null;
                  if (focused !== document.body && isAvailableFocusTarget(focused)) return;
                  returnFocus(
                    root.current?.querySelector<HTMLElement>(
                      route === "settings"
                        ? '.settings-screen [role="tab"][aria-selected="true"]'
                        : "main button:not(:disabled)",
                    ) ?? null,
                  );
                }
              }}
            >
              <nav className="pause-menu-choices" aria-label="Pause menu">
                {menuItems(false)}
              </nav>
            </PopoverContent>
          ) : null}
          {overlays}
        </div>
      </Popover>
    </SurfaceTransition>
  );
}
