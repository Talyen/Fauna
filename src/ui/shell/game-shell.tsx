import { useMessages } from "../shared/localization/message-context";
import { eventPresentation } from "../shared/localization/event-presentation";
import { measurePerformance, startPerformanceSpan } from "../../lib/performance";
import { EffectScope, EffectsScene } from "../shared/effects/effects";
import { useDevicePreferences } from "../settings/preferences";
import { bossEncounter } from "../../game/encounters";
import { pendingReplacement } from "../../game/team";
import { soleReplacement } from "../../application/battle-policy";
import { ShellOverlays } from "./overlays";
import { routeInput } from "./input";
import { useActivationAudio } from "../audio/activation-audio";
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
import { Campfire } from "../expedition/campfire";
import { Settings } from "../settings/settings";
import { useGameAudio } from "../audio/game-audio";
import { JourneyResults } from "../expedition/journey-results";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { useStore } from "zustand";
import { flushSync } from "react-dom";
import { Menu, Repeat, Pause, FastForward } from "lucide-react";
import type { Session } from "../../application/session";
import { Button } from "../../components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "../../components/ui/popover";
import { BattleScreen } from "../battle/battle-screen";
import type { Inspection } from "../shared/inspection-model";
import { localizedControllerPrompts, type ControllerFamily } from "../shared/navigation/controller-prompts";
import { type Controls, connectInput, type InputAction } from "../shared/navigation/input";
import { returnFocus } from "../shared/navigation/focus";
import { Draft } from "../expedition/draft";
import { TeamSelection } from "../expedition/team-selection";
import { Rewards } from "../expedition/rewards";
import { Talents } from "../talents/talents";
import { Collection } from "../collection/collection";

import { activeSurface, initialNavigation, shellNavigation } from "./navigation";
import { useShellFocus } from "./focus";
import { useCombatFeedback } from "../battle/combat-feedback";
import type { Command } from "../../game/types";
import "../battle/mana-crystals.css";
import type { Modal } from "./types";
export function GameShell({ session, desktop = false }: { session: Session; desktop?: boolean }) {
  const i18n = useMessages();
  const view = useStore(session.store),
    game = view.game;
  const talentPoints = KEYWORDS.reduce((total, keyword) => total + availablePoints(game, keyword), 0);
  const root = useRef<HTMLDivElement>(null),
    gameControls: Controls = useRef(null),
    inspectionControls: Controls = useRef(null),
    talentControls: Controls = useRef(null),
    collectionControls: Controls = useRef(null);
  const [preferences, updatePreferences] = useDevicePreferences();
  const { audio, autoEndTurn, controller } = preferences;
  const [draftStarted, setDraftStarted] = useState(false);
  const [navigationState, transition] = useReducer(
    (state: Parameters<typeof shellNavigation>[0], action: Parameters<typeof shellNavigation>[1]) =>
      measurePerformance("navigation-intent", () => shellNavigation(state, action), { action: action.type }),
    initialNavigation,
  );
  const { route } = navigationState.page;
  const { menuInstance, modalInstance } = navigationState;
  const menuGeneration = useRef(0);
  const showMenu = useCallback(
    () => transition({ type: "openPause", instance: ++menuGeneration.current }),
    [],
  );
  const [mode, setMode] = useState<"pointer" | "keyboard" | "controller">("pointer");
  const [detectedController, setDetectedController] = useState<ControllerFamily>("xbox");
  const [navigation, setNavigation] = useState(false);
  const playSound = useGameAudio(session, audio, route === "home");
  useActivationAudio(playSound);
  const controllerKind = controller === "auto" ? detectedController : controller;
  const controllerPrompts = localizedControllerPrompts(controllerKind, i18n);
  const active =
    !["victory", "defeat"].includes(game.phase) &&
    (game.team.length > 0 || game.selected.length > 0 || (game.phase === "draft" && draftStarted));
  const replacement = pendingReplacement(game);
  const surface = activeSurface(navigationState, !!replacement, view.overlayActive || view.cloud.blocking);
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
    phase: game.phase,
    blocking: view.cloud.blocking,
    status: view.cloud.status,
    generation: menuGeneration,
    instance: menuInstance,
  });
  const inspect = useCallback(
    (item: Inspection | null) => transition(item ? { type: "inspect", item } : { type: "closeInspection" }),
    [],
  );
  const closeDialog = () => transition({ type: "closeDialog" });
  const closePause = () => transition({ type: "closePause" });
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
  const automaticReplacementFocus = useRef(false);
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
  useEffect(
    () =>
      session.store.subscribe((current, previous) => {
        if (!current.cloud.blocking || previous.cloud.blocking) return;
        transition({ type: "externalBlock" });
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
      inspect,
      closeDialog,
      closePause,
      surface: surface.top,
      backFromPage,
      openMenu,
    });
  const disconnectRef = useRef(() => {});
  useEffect(() => {
    disconnectRef.current = () => {
      setAutoplay(false);
      if (route === "play") showMenu();
    };
  }, [route, setAutoplay, showMenu]);
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
      { detected: setDetectedController, disconnected: () => disconnectRef.current() },
    );
    return () => {
      disconnect();
      if (previous === undefined) delete document.documentElement.dataset.input;
      else document.documentElement.dataset.input = previous;
      if (previousFocus === undefined) delete document.documentElement.dataset.focus;
      else document.documentElement.dataset.focus = previousFocus;
    };
  }, [session.store]);
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
          transition({ type: "play" });
        } else if (send({ type: "newRun", seed: Date.now() >>> 0 })) {
          setDraftStarted(true);
          transition({ type: "play" });
        }
      }}
      onBoons={() => openModal("boons")}
      onNavigate={navigate}
      onEndJourney={() => {
        if (send({ type: "abandon" })) {
          focus.rememberAction(null);
          setDraftStarted(false);
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
        glow={preferences.glow}
        particles={preferences.particles}
      />
      <SurfaceTransition
        token={`${route}:${game.phase}`}
        battle={route === "play" && game.phase === "battle"}
      >
        <Popover
          modal
          open={surface.top === "pause"}
          onOpenChange={(open) => (open ? showMenu() : closePause())}
        >
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
                {i18n.message(
                  "recovery.save",
                  "Progress cannot be saved right now; keep Fauna open while it retries",
                )}
              </p>
            ) : null}
            {!view.cloud.blocking ? (
              <>
                {route === "home" ? <HomeScreen>{menuItems(true)}</HomeScreen> : null}
                {route === "talents" ? (
                  <Talents game={game} send={send} openMenu={backFromPage} controls={talentControls} />
                ) : null}
                {route === "collection" ? (
                  <Collection
                    game={game}
                    controls={collectionControls}
                    openMenu={backFromPage}
                    inspect={inspect}
                  />
                ) : null}
                {route === "glossary" ? (
                  <GlossaryScreen
                    back={backFromPage}
                    controller={mode === "controller"}
                    prompts={controllerPrompts}
                  />
                ) : null}
                {route === "settings" ? (
                  <Screen className="menu-screen settings-screen" aria-labelledby="menu-screen-title">
                    <header className="collection-heading">
                      <ScreenHeading id="menu-screen-title" back={backFromPage} openMenu={backFromPage}>
                        {i18n.message("menu.settings", "Settings")}
                      </ScreenHeading>
                    </header>
                    <Settings
                      session={session}
                      preferences={preferences}
                      update={updatePreferences}
                      openLanguage={() => openModal("language")}
                    />
                  </Screen>
                ) : null}
                <EffectScope name="play">
                  <div className="play-surface" hidden={route !== "play"} inert={route !== "play"}>
                    <HeaderNavigation.Provider
                      value={{
                        back: () => transition({ type: "home" }),
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
                          data-menu-anchor
                          aria-label={i18n.message("battle.openMenu", "Open menu")}
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
                          aria-label={i18n.message("battle.skipCombat", "Skip combat")}
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
                          aria-label={i18n.message("battle.autoplay", "Auto-play")}
                          aria-pressed={autoplay}
                          onClick={() => setAutoplay(!autoplay)}
                        >
                          {autoplay ? <Pause aria-hidden="true" /> : <Repeat aria-hidden="true" />}
                        </Button>
                      ) : null}
                      {game.phase === "draft" ? (
                        <Draft game={game} send={send} inspect={inspect} />
                      ) : game.phase === "teamSelection" ? (
                        <TeamSelection
                          game={game}
                          send={send}
                          inspect={inspect}
                          recovery={view.committedCommand?.type === "rest" ? view.events : undefined}
                        />
                      ) : game.phase === "support" ? (
                        <SupportScreen game={game} send={send} />
                      ) : game.phase === "campfire" ? (
                        <Campfire game={game} send={send} />
                      ) : game.phase === "battle" ? (
                        <BattleScreen
                          key={game.encounter}
                          clearSelection={surface.clearSelection || autoplay}
                          onManualStart={() => setAutoplay(false)}
                          openPile={(pile) => openModal(pile)}
                          openingDraw={view.committedCommand?.type === "beginBattle"}
                          game={game}
                          send={send}
                          controls={gameControls}
                          bursts={bursts}
                          onDenied={deny}
                          controller={mode === "controller"}
                          endTurnPrompt={controllerKind === "playstation" ? "△" : controllerPrompts.endTurn}
                          endTurnPromptLabel={controllerPrompts.endTurn}
                          navigateFocus={navigation}
                        />
                      ) : game.phase === "recruit" || game.phase === "boon" ? (
                        <Rewards
                          key={`${game.encounter}-${game.phase}`}
                          game={game}
                          visible={route === "play"}
                          send={send}
                          inspect={inspect}
                        />
                      ) : (
                        <JourneyResults game={game} home={leaveResults} />
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
