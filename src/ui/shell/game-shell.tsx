import { EffectScope, EffectsScene } from "../shared/effects/effects";
import { useEffectPreferences } from "../settings/effect-preferences";
import { bossEncounter } from "../../game/encounters";
import { pendingReplacement } from "../../game/team";
import { ShellOverlays } from "./overlays";
import { routeInput } from "./input";
import { useActivationAudio } from "../audio/activation-audio";
import { useDisplayPreferences } from "../settings/display-preferences";
import { UnlockScreen } from "../expedition/unlock-screen";
import { HomeScreen } from "../menu/home-screen";
import { GlossaryScreen } from "../menu/glossary-screen";
import { MenuActions, type MenuPage } from "../menu/menu-actions";
import { Screen, ScreenHeading, HeaderNavigation } from "../shared/navigation/screen";
import { captureSwapMotion } from "../battle/swap-motion";
import { SurfaceTransition } from "../shared/surface-transition";
import { Loading } from "../shared/loading";
import { SupportScreen } from "../expedition/support-screen";
import { KEYWORDS, availablePoints } from "../../game/progression";
import { useAutoplay } from "../battle/autoplay";
import { observeUnlocks } from "../expedition/unlock-reveals";
import { Campfire } from "../expedition/campfire";
import { Settings } from "../settings/settings";
import { useAudioPreferences } from "../settings/audio-preferences";
import { useGameAudio } from "../audio/game-audio";
import { JourneyResults } from "../expedition/journey-results";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { flushSync } from "react-dom";
import { Menu, Repeat, Pause, FastForward } from "lucide-react";
import type { Session } from "../../application/session";
import { Button } from "../../components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "../../components/ui/popover";
import { BattleScreen } from "../battle/battle-screen";
import type { Inspection } from "../shared/inspection-model";
import { type Controls, connectInput, type InputAction } from "../shared/navigation/input";
import { Draft } from "../expedition/draft";
import { TeamSelection } from "../expedition/team-selection";
import { Rewards } from "../expedition/rewards";
import { Talents } from "../talents/talents";
import { Collection } from "../collection/collection";

import { isAvailableFocusTarget, returnFocus } from "../shared/navigation/focus";
import { useCombatFeedback } from "../battle/combat-feedback";
import type { Command } from "../../game/types";
import type { SpeciesId } from "../../game/content";
import "../battle/mana-crystals.css";
import type { Route, Modal } from "./types";
export function GameShell({ session, desktop = false }: { session: Session; desktop?: boolean }) {
  const view = useStore(session.store),
    game = view.game;
  const talentPoints = KEYWORDS.reduce((total, keyword) => total + availablePoints(game, keyword), 0);
  const root = useRef<HTMLDivElement>(null),
    gameControls: Controls = useRef(null),
    inspectionControls: Controls = useRef(null),
    talentControls: Controls = useRef(null),
    collectionControls: Controls = useRef(null);
  const effectPreferences = useEffectPreferences();
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
  useActivationAudio(playSound);
  const { scale, setScale, tooltipScale, setTooltipScale, autoEndTurn, setAutoEndTurn } =
    useDisplayPreferences();
  const origin = useRef<Route>("home"),
    pauseOpener = useRef<HTMLElement | null>(null),
    modalOpener = useRef<HTMLElement | null>(null);
  const active =
    !["victory", "defeat"].includes(game.phase) &&
    (game.team.length > 0 || game.selected.length > 0 || (game.phase === "draft" && draftStarted));
  const [pendingUnlocks, setPendingUnlocks] = useState<SpeciesId[]>([]);
  const [reveals, setReveals] = useState<SpeciesId[]>([]);
  useEffect(
    () => observeUnlocks(session, (ids) => setPendingUnlocks((old) => [...new Set([...old, ...ids])])),
    [session],
  );
  const replacement = pendingReplacement(game);
  const paused =
    !!replacement ||
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
  const swapMotion = useRef<ReturnType<typeof captureSwapMotion> | null>(null);
  useEffect(() => () => swapMotion.current?.cancel(), []);
  const send = useCallback(
    (command: Command) => {
      setAutoplay(false);
      swapMotion.current?.cancel();
      const motion = command.type === "swap" ? captureSwapMotion(command.activeId, command.reserve) : null;
      const accepted = session.command(
        command.type === "play" || command.type === "swap" ? { ...command, autoEndTurn } : command,
      );
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
  useEffect(
    () =>
      session.store.subscribe((current, previous) => {
        if (!current.cloud.blocking || previous.cloud.blocking) return;
        setModal(null);
        setInspection(null);
        setMenu(false);
        setAutoplay(false);
      }),
    [session, setAutoplay],
  );
  useEffect(() => {
    if (!view.overlayActive) return;
    setAutoplay(false);
    if (route === "play") showMenu();
  }, [view.overlayActive, route, setAutoplay, showMenu]);
  const input = (action: InputAction) =>
    routeInput(action, {
      session,
      inspection,
      inspectionControls,
      route,
      collectionControls,
      modal,
      menu,
      talentControls,
      gameControls,
      paused,
      game,
      setInspection,
      setModal,
      setMenu,
      backFromPage,
      openMenu,
    });
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
  }, [session.store]);
  const focusScreen = useEffectEvent(() => {
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
  });
  useLayoutEffect(() => {
    focusScreen();
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
  return (
    <EffectScope name={route}>
      <EffectsScene
        scope={
          inspection
            ? "inspection"
            : (modal ?? (replacement && route === "play" && !menu ? "replacement" : menu ? "menu" : route))
        }
        scene={
          route === "play"
            ? game.phase === "draft"
              ? "none"
              : game.phase === "battle"
                ? bossEncounter(game)
                  ? "boss"
                  : "battle"
                : game.phase === "campfire"
                  ? "campfire"
                  : "default"
            : "default"
        }
        glow={effectPreferences.glow}
        particles={effectPreferences.particles}
      />
      <SurfaceTransition
        token={`${route}:${game.phase}`}
        battle={route === "play" && game.phase === "battle"}
      >
        <Popover modal open={menu && !modal && !inspection} onOpenChange={setMenu}>
          <PopoverAnchor virtualRef={menuAnchor} />
          <div
            ref={root}
            className={`app ${route === "play" && game.phase === "battle" ? "in-battle" : ""}`}
            data-input={mode}
            data-focus={navigation ? "visible" : "hidden"}
            data-route={route}
            data-phase={game.phase}
            data-paused={paused || undefined}
            data-save-status={view.saveStatus}
          >
            {view.saveUnavailable ? (
              <p className="save-notice" role="status">
                Progress cannot be saved right now; keep Fauna open while it retries
              </p>
            ) : null}
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
                {route === "glossary" ? <GlossaryScreen back={backFromPage} /> : null}
                {route === "settings" ? (
                  <Screen className="menu-screen settings-screen" aria-labelledby="menu-screen-title">
                    <header className="collection-heading">
                      <ScreenHeading id="menu-screen-title" back={backFromPage} openMenu={backFromPage}>
                        Settings
                      </ScreenHeading>
                    </header>
                    <Settings
                      effects={effectPreferences}
                      session={session}
                      audio={audioPreferences}
                      updateAudio={updateAudioPreferences}
                      scale={scale}
                      setScale={setScale}
                      tooltipScale={tooltipScale}
                      setTooltipScale={setTooltipScale}
                      desktop={desktop}
                      autoEndTurn={autoEndTurn}
                      setAutoEndTurn={setAutoEndTurn}
                    />
                  </Screen>
                ) : null}
                <EffectScope name="play">
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
                            view.overlayActive ||
                            menu ||
                            modal !== null ||
                            inspection !== null ||
                            autoplay ||
                            !!replacement
                          }
                          onManualStart={() => setAutoplay(false)}
                          openPile={(pile) => openModal(pile)}
                          openingDraw={view.committedCommand?.type === "beginBattle"}
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
                </EffectScope>
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
                <EffectScope name="menu">
                  <nav className="pause-menu-choices" aria-label="Pause menu">
                    {menuItems(false)}
                  </nav>
                </EffectScope>
              </PopoverContent>
            ) : null}
            <ShellOverlays
              modal={modal}
              modalInstance={modalInstance}
              menu={menu}
              modalOpener={modalOpener}
              game={game}
              send={send}
              setModal={setModal}
              inspection={inspection}
              setInspection={setInspection}
              session={session}
              inspectionControls={inspectionControls}
              route={route}
            />
          </div>
        </Popover>
      </SurfaceTransition>
    </EffectScope>
  );
}
