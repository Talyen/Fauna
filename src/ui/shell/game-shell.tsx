import { useMessages } from "../shared/localization/message-context";
import { eventPresentation } from "../shared/localization/event-presentation";
import { measurePerformance, startPerformanceSpan } from "../../lib/performance";
import { EffectScope, EffectsScene } from "../shared/effects/effects";
import { useDevicePreferences } from "../settings/preferences";
import { bossEncounter } from "../../game/encounters";
import { pendingReplacement } from "../../game/team";
import { hasAvailablePlay } from "../../game/play-queries";
import { MAX_BATTLE_TURN } from "../../game/state-limits";
import { soleReplacement } from "../../application/battle-policy";
import { ShellOverlays } from "./overlays";
import { routeInput } from "./input";
import { useActivationAudio } from "../audio/activation-audio";
import { HomeScreen } from "../menu/home-screen";
import { MenuActions, type MenuPage } from "../menu/menu-actions";
import { Screen, ScreenHeading, HeaderNavigation } from "../shared/navigation/screen";
import { captureSwapMotion } from "../battle/swap-motion";
import { SurfaceTransition } from "../shared/surface-transition";
import { Loading } from "../shared/loading";
import { SupportScreen } from "../expedition/support-screen";
import { KEYWORDS, availablePoints } from "../../game/progression";
import { useAutoplay } from "../battle/autoplay";
import { Campfire } from "../expedition/campfire";
import { Settings } from "../settings/settings";
import { useGameAudio } from "../audio/game-audio";
import { JourneyResults } from "../expedition/journey-results";
import {
  startTransition,
  useDeferredValue,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useArtwork, useUpcomingArtwork } from "../shared/artwork";
import { assetUrl, talentArtwork } from "../shared/assets";
import { battleArtwork } from "../startup/artwork";
import { useStore } from "zustand";
import { flushSync } from "react-dom";
import { Menu, Play, Pause, FastForward, Trophy } from "lucide-react";
import type { Session } from "../../application/session";
import { Button } from "../../components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "../../components/ui/popover";
import { BattleScreen } from "../battle/battle-screen";
import type { Inspection } from "../shared/inspection-model";

import { type Controls, connectInput, type InputAction } from "../shared/navigation/input";
import { returnFocus } from "../shared/navigation/focus";
import { Draft } from "../expedition/draft";
import { TeamSelection } from "../expedition/team-selection";
import { Rewards } from "../expedition/rewards";
import { Talents } from "../talents/talents";
import { Collection, collectionSpecies } from "../collection/collection";

import { activeSurface, initialNavigation, shellNavigation } from "./navigation";
import { useShellFocus } from "./focus";
import { useCombatFeedback } from "../battle/combat-feedback";
import type { Command } from "../../game/types";
import "../battle/mana-crystals.css";
import type { Modal } from "./types";
export function GameShell({ session }: { session: Session }) {
  const i18n = useMessages();
  const view = useStore(session.store);
  const deferredGame = useDeferredValue(view.game);
  // The full battle artwork set is prepared, so takeover must not restore a deferred hand.
  const game =
    view.game.phase === "battle" &&
    deferredGame.phase === "battle" &&
    view.game.encounter === deferredGame.encounter
      ? view.game
      : deferredGame;
  const talentPoints = KEYWORDS.reduce((total, keyword) => total + availablePoints(game, keyword), 0);
  const root = useRef<HTMLDivElement>(null),
    gameControls: Controls = useRef(null),
    inspectionControls: Controls = useRef(null),
    talentControls: Controls = useRef(null),
    collectionControls: Controls = useRef(null);
  const [preferences, updatePreferences] = useDevicePreferences();
  const { audio, autoEndTurn } = preferences;
  const [navigationState, dispatchNavigation] = useReducer(
    (state: Parameters<typeof shellNavigation>[0], action: Parameters<typeof shellNavigation>[1]) =>
      measurePerformance("navigation-intent", () => shellNavigation(state, action), { action: action.type }),
    initialNavigation,
  );
  const transition = useCallback(
    (action: Parameters<typeof shellNavigation>[1]) => startTransition(() => dispatchNavigation(action)),
    [],
  );
  const { route } = navigationState.page;
  const { menuInstance, modalInstance } = navigationState;
  const menuGeneration = useRef(0);
  const showMenu = useCallback(
    () => transition({ type: "openPause", instance: ++menuGeneration.current }),
    [transition],
  );
  const [mode, setMode] = useState<"pointer" | "keyboard" | "controller">("pointer");
  const [navigation, setNavigation] = useState(false);
  const playSound = useGameAudio(session, audio, route === "home");
  useActivationAudio(playSound);
  const motionPaused = activeSurface(
    navigationState,
    false,
    view.overlayActive || view.cloud.blocking,
  ).paused;
  const { bursts, scene, presenting, finish, isPresenting, deny } = useCombatFeedback(
    session,
    root,
    playSound,
    motionPaused,
  );
  const shown = scene ?? game;
  const active = !["victory", "defeat"].includes(game.phase) && (game.phase !== "draft" || game.draftStarted);
  const replacement = pendingReplacement(game);
  const surface = activeSurface(
    navigationState,
    !!replacement && !presenting,
    view.overlayActive || view.cloud.blocking,
  );
  const { modal, menu, inspection, paused } = surface;
  useEffect(() => {
    startPerformanceSpan("surface-committed", {
      route,
      modal: String(modal ?? "none"),
      revision: game.revision,
    })();
  }, [route, modal, game.revision]);
  const focus = useShellFocus({
    root,
    route,
    obscured: !!modal || !!inspection,
    menu,
    ready: view.ready,
    pointer: mode === "pointer",
    phase: shown.phase,
    blocking: view.cloud.blocking,
    status: view.cloud.status,
    generation: menuGeneration,
    instance: menuInstance,
  });
  const inspect = useCallback(
    (item: Inspection | null) => transition(item ? { type: "inspect", item } : { type: "closeInspection" }),
    [transition],
  );
  const closeDialog = () => transition({ type: "closeDialog" });
  const closePause = () => transition({ type: "closePause" });
  const [autoplay, setAutoplay] = useAutoplay(session, paused || presenting, autoEndTurn, isPresenting);
  const toggleAutoplay = (enabled: boolean) => {
    setAutoplay(enabled);
    updatePreferences({ autoplay: enabled });
  };
  useEffect(() => {
    if (route === "play" && game.phase === "battle" && preferences.rememberAutoplay && preferences.autoplay)
      setAutoplay(true);
  }, [
    game.phase,
    game.encounter,
    route,
    preferences.rememberAutoplay,
    preferences.autoplay,
    session,
    setAutoplay,
  ]);
  useEffect(() => {
    if (route !== "play") setAutoplay(false);
  }, [route, setAutoplay]);
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
  useEffect(() => {
    if (
      !autoEndTurn ||
      presenting ||
      route !== "play" ||
      surface.top !== "page" ||
      !view.ready ||
      view.closing ||
      game.phase !== "battle" ||
      game.battle.turn >= MAX_BATTLE_TURN ||
      pendingReplacement(game) ||
      hasAvailablePlay(game)
    )
      return;
    // Yield between consecutive unplayable turns so the player can pause or change settings.
    const timer = setTimeout(() => {
      const current = session.store.getState();
      if (
        current.game === game &&
        current.ready &&
        !current.closing &&
        !current.overlayActive &&
        !current.cloud.blocking
      )
        session.command({ type: "endTurn" });
    }, 250);
    return () => clearTimeout(timer);
  }, [session, game, autoEndTurn, presenting, route, surface.top, view.ready, view.closing]);
  const automaticReplacementFocus = useRef(false);
  const automaticMerchantFocus = useRef(false);
  useLayoutEffect(() => {
    if (surface.top !== "replacement" || !view.ready || view.closing) return;
    const current = session.store.getState();
    if (current.game !== game || current.overlayActive || current.cloud.blocking) return;
    const command = soleReplacement(current.game, autoEndTurn);
    if (command && session.command(command)) automaticReplacementFocus.current = true;
  }, [
    session,
    game,
    autoEndTurn,
    surface.top,
    view.ready,
    view.closing,
    view.overlayActive,
    view.cloud.blocking,
  ]);
  useLayoutEffect(() => {
    if (!automaticReplacementFocus.current) return;
    if (route !== "play" || game.phase !== "battle") {
      automaticReplacementFocus.current = false;
      return;
    }
    if (surface.top !== "page") return;
    automaticReplacementFocus.current = false;
    returnFocus(root.current?.querySelector<HTMLElement>(".hand .action-card, .end-turn") ?? null);
  }, [game, route, surface.top]);
  useLayoutEffect(() => {
    if (route !== "play" || surface.top !== "page" || !view.ready || view.closing) return;
    const current = session.store.getState();
    if (current.game !== game || current.overlayActive || current.cloud.blocking) return;
    if (game.phase === "support" && game.support.purchased)
      automaticMerchantFocus.current = session.command({ type: "leaveSupport", visit: game.support.id });
  }, [session, game, route, surface.top, view.ready, view.closing, view.overlayActive, view.cloud.blocking]);
  useLayoutEffect(() => {
    if (!automaticMerchantFocus.current) return;
    if (route !== "play") {
      automaticMerchantFocus.current = false;
      return;
    }
    if (game.phase === "support") return;
    if (game.phase !== "teamSelection") {
      automaticMerchantFocus.current = false;
      return;
    }
    if (surface.top !== "page") return;
    automaticMerchantFocus.current = false;
    returnFocus(root.current?.querySelector<HTMLElement>("[data-encounter]") ?? null);
  }, [game, route, surface.top]);
  const leaveResults = () => transition({ type: "home" });
  const menuAnchor = useRef({
    getBoundingClientRect: () =>
      root.current
        ?.querySelector<HTMLButtonElement>(".play-surface button[data-menu-anchor]")
        ?.getBoundingClientRect() ?? new DOMRect(),
  });
  const openMenu = () => {
    focus.rememberPauseOpener();
    showMenu();
  };
  const openModal = (next: NonNullable<Modal>) => {
    focus.rememberDialogOpener(menu);
    transition({ type: "openDialog", modal: next });
  };
  const navigate = (page: MenuPage) => {
    focus.rememberAction(page);
    transition({ type: "openMenuPage", page });
  };
  const backFromPage = () => transition({ type: "backFromPage", instance: ++menuGeneration.current });
  const backFromPlay = () => {
    if (game.phase === "campfire") send({ type: "leaveCampfire" });
    else if (game.phase === "support") send({ type: "leaveSupport", visit: game.support.id });
    else if (game.phase !== "recruit" || game.reward.selectedRecruit === undefined)
      transition({ type: "home" });
  };
  useEffect(
    () =>
      session.store.subscribe((current, previous) => {
        if (!current.cloud.blocking || previous.cloud.blocking) return;
        transition({ type: "externalBlock" });
        setAutoplay(false);
      }),
    [session, setAutoplay, transition],
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
      inspect,
      closeDialog,
      closePause,
      surface: surface.top,
      backFromPage,
      backFromPlay,
      openMenu,
    });
  const actionRef = useRef(input);
  useLayoutEffect(() => {
    actionRef.current = input;
  });
  useEffect(() => {
    const settle = (event: Event) => {
      if (
        isPresenting() &&
        (event.type === "keydown" || (event.target instanceof Node && root.current?.contains(event.target)))
      )
        flushSync(finish);
    };
    window.addEventListener("pointerdown", settle, true);
    window.addEventListener("keydown", settle, true);
    return () => {
      window.removeEventListener("pointerdown", settle, true);
      window.removeEventListener("keydown", settle, true);
    };
  }, [finish, isPresenting]);
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
  useArtwork(useMemo(() => battleArtwork(game), [game]));
  useUpcomingArtwork(
    route === "home"
      ? [
          ...collectionSpecies(game)
            .slice(0, 6)
            .map((entry) => assetUrl(`creature.${entry.id}`)),
          ...talentArtwork,
        ]
      : [],
  );
  if (!view.ready)
    return (
      <Screen className="loading">
        <Loading />
      </Screen>
    );
  const menuItems = (home: boolean) => (
    <MenuActions
      home={home}
      battle={game.phase === "battle"}
      active={active}
      talentPoints={talentPoints}
      closing={view.closing}
      onContinue={() => {
        if (!home || active) {
          transition({ type: "play" });
        } else if (send({ type: "newRun", seed: Date.now() >>> 0 })) {
          transition({ type: "play" });
        }
      }}
      onNavigate={navigate}
      onEndJourney={() => {
        if (send({ type: "abandon" })) {
          focus.rememberAction(null);
          transition({ type: game.phase === "draft" ? "home" : "play" });
        }
      }}
      onHome={() => transition({ type: "home" })}
      onQuit={() => void session.quit()}
    />
  );
  return (
    <EffectScope name={route}>
      <EffectsScene
        scope={surface.scope}
        scene={
          route === "play"
            ? shown.phase === "draft"
              ? "none"
              : shown.phase === "battle"
                ? bossEncounter(shown)
                  ? "boss"
                  : "battle"
                : shown.phase === "campfire"
                  ? "campfire"
                  : "default"
            : "default"
        }
        glow={preferences.glow}
        particles={preferences.particles}
      />
      <SurfaceTransition
        token={`${route}:${shown.phase}`}
        battle={route === "play" && shown.phase === "battle"}
      >
        <Popover
          modal
          open={surface.top === "pause"}
          onOpenChange={(open) => (open ? showMenu() : closePause())}
        >
          <PopoverAnchor virtualRef={menuAnchor} />
          <div
            ref={root}
            className={`app ${route === "play" && shown.phase === "battle" ? "in-battle" : ""}`}
            data-input={mode}
            data-focus={navigation ? "visible" : "hidden"}
            data-route={route}
            data-phase={shown.phase}
            data-paused={paused || undefined}
            data-save-status={view.saveStatus}
          >
            {!view.cloud.blocking ? (
              <>
                {route === "home" ? <HomeScreen>{menuItems(true)}</HomeScreen> : null}
                {route === "talents" ? (
                  <Talents game={shown} send={send} openMenu={backFromPage} controls={talentControls} />
                ) : null}
                {route === "collection" ? (
                  <Collection
                    game={shown}
                    controls={collectionControls}
                    openMenu={backFromPage}
                    inspect={inspect}
                  />
                ) : null}
                {route === "settings" ? (
                  <Screen className="menu-screen settings-screen" aria-labelledby="menu-screen-title">
                    <header className="collection-heading">
                      <ScreenHeading id="menu-screen-title" back={backFromPage} openMenu={backFromPage}>
                        {i18n.message("menu.options", "Options")}
                      </ScreenHeading>
                    </header>
                    <Settings
                      session={session}
                      preferences={preferences}
                      update={updatePreferences}
                      onClear={() => {
                        session.clearProgress();
                        transition({ type: "home" });
                      }}
                    />
                  </Screen>
                ) : null}
                <EffectScope name="play">
                  <div className="play-surface" hidden={route !== "play"} inert={route !== "play"}>
                    <HeaderNavigation.Provider
                      value={{
                        back: backFromPlay,
                        openMenu,
                        menuOpen: surface.top === "pause",
                        deck: [
                          "draft",
                          "teamSelection",
                          "recruit",
                          "boon",
                          "support",
                          "campfire",
                          "victory",
                          "defeat",
                        ].includes(shown.phase)
                          ? () => openModal("deck")
                          : undefined,
                      }}
                    >
                      {shown.phase === "battle" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="menu-button menu-trigger"
                          data-menu-anchor
                          aria-expanded={surface.top === "pause"}
                          aria-label={i18n.message("battle.openMenu", "Open menu")}
                          onClick={openMenu}
                        >
                          <Menu aria-hidden="true" />
                        </Button>
                      ) : null}
                      {import.meta.env.DEV && shown.phase === "battle" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="skip-combat-control compact-icon-control"
                          aria-label={i18n.message("battle.skipCombat", "Skip combat")}
                          onClick={() => send({ type: "devWinBattle" })}
                        >
                          <FastForward aria-hidden="true" className="menu-icon-skip" />
                        </Button>
                      ) : null}
                      {shown.phase === "battle" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="autoplay-control compact-icon-control"
                          aria-label={i18n.message("battle.autoplay", "Auto-play")}
                          aria-pressed={autoplay}
                          onClick={() => toggleAutoplay(!autoplay)}
                        >
                          {autoplay ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                        </Button>
                      ) : null}
                      {shown.phase === "battle" && shown.boons.length ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="boon-control compact-icon-control"
                          aria-label={i18n.message("menu.boons", "Boons")}
                          onClick={() => openModal("boons")}
                        >
                          <Trophy aria-hidden="true" />
                        </Button>
                      ) : null}
                      {shown.phase === "draft" ? (
                        <Draft game={shown} send={send} inspect={inspect} />
                      ) : shown.phase === "teamSelection" ? (
                        <TeamSelection
                          game={shown}
                          send={send}
                          inspect={inspect}
                          purchase={
                            view.committedCommand?.type === "leaveSupport" &&
                            view.eventPreviousGame?.phase === "support"
                              ? view.eventPreviousGame.support
                              : undefined
                          }
                          recovery={view.committedCommand?.type === "rest" ? view.events : undefined}
                        />
                      ) : shown.phase === "support" ? (
                        <SupportScreen game={shown} send={send} />
                      ) : shown.phase === "campfire" ? (
                        <Campfire game={shown} send={send} />
                      ) : shown.phase === "battle" ? (
                        <BattleScreen
                          key={shown.encounter}
                          clearSelection={surface.clearSelection || autoplay}
                          onManualStart={() => setAutoplay(false)}
                          openPile={(pile) => openModal(pile)}
                          openingDraw={view.committedCommand?.type === "beginBattle"}
                          game={shown}
                          presentationOnly={view.game.phase !== "battle"}
                          send={send}
                          controls={gameControls}
                          bursts={bursts}
                          onDenied={deny}
                          controller={false}
                          inspectEnemy={(id) => {
                            const enemy = shown.battle.enemies.find((unit) => unit.id === id);
                            if (enemy) inspect({ species: enemy.species, enemyId: id });
                          }}
                          navigateFocus={navigation}
                        />
                      ) : shown.phase === "recruit" || shown.phase === "boon" ? (
                        <Rewards
                          key={`${shown.encounter}-${shown.phase}`}
                          game={shown}
                          visible={route === "play"}
                          send={send}
                          inspect={inspect}
                        />
                      ) : (
                        <JourneyResults
                          game={shown}
                          home={leaveResults}
                          openBoons={() => openModal("boons")}
                        />
                      )}
                    </HeaderNavigation.Provider>
                    <div className="sr-only" role="log" aria-live="polite">
                      {view.events
                        .map((event) => eventPresentation(game, event, i18n, view.eventPreviousGame))
                        .join(" ")}
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
                aria-label={i18n.message("menu.pause", "Pause menu")}
                onOpenAutoFocus={focus.openMenuFocus}
                onCloseAutoFocus={focus.closeMenuFocus}
              >
                <EffectScope name="menu">
                  <nav className="pause-menu-choices" aria-label={i18n.message("menu.pause", "Pause menu")}>
                    {menuItems(false)}
                  </nav>
                </EffectScope>
              </PopoverContent>
            ) : null}
            <ShellOverlays
              modal={modal}
              modalInstance={modalInstance}
              menu={menu}
              modalOpener={focus.modalOpener}
              game={game}
              send={send}
              closeDialog={closeDialog}
              inspection={inspection}
              inspect={inspect}
              session={session}
              inspectionControls={inspectionControls}
              surface={surface.top}
            />
          </div>
        </Popover>
      </SurfaceTransition>
    </EffectScope>
  );
}
