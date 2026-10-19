import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import type { Session } from "../application/session";
import { Menu } from "lucide-react";
import { returnFocus } from "./focus";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { DamageValue } from "./combat-values";
import { SPECIES, definition, species, enemyDamageType } from "../game/content";
import type { SpeciesId } from "../game/content";
import { ActionCard, AllyCard, CreatureCard, EnemyCard } from "./cards";
import { connectInput, moveFocus } from "./input";
import type { InputAction } from "./input";
import type { Card } from "../game/types";
import { TooltipProvider } from "../components/ui/tooltip";
import { ActionDetails, CreatureDetails } from "./card-details";
import { GLOSSARY } from "../game/glossary";
import { previewPlay } from "../game/preview";
import { dispatch } from "../game/engine";
import { EnemyIntent } from "./enemy-intent";
import { TargetPreview } from "./target-preview";
import { CombatFeedback, useCombatFeedback } from "./combat-feedback";

type Inspection = { card: Card } | { species: SpeciesId; enemyId?: string };
function Inspector({ item, session, onClose }: { item: Inspection; session: Session; onClose: () => void }) {
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const game = useStore(session.store, (s) => s.game);
  const kind = "card" in item ? definition(item.card.definitionId).species : item.species;
  const creature = species(kind);
  const ally = game.team.find((c) => c.species === kind);
  const enemy = "enemyId" in item ? game.battle?.enemies.find((e) => e.id === item.enemyId) : undefined;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={`inspection ${"card" in item ? "single-card" : ""}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus(opener);
        }}
      >
        <DialogTitle className="sr-only">
          {"card" in item
            ? `${definition(item.card.definitionId).name} details`
            : `${enemy?.name ?? creature.name} details`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {enemy ? "Enemy attack" : creature.description}
        </DialogDescription>
        {"card" in item ? (
          <>
            <ActionCard card={item.card} ownerName={creature.name} onClick={() => {}} presentation />
            <ActionDetails
              card={item.card}
              ownerName={creature.name}
              actor={game.team.find((c) => c.id === item.card.ownerId)}
            />
            <p className="trait-description">{creature.description}</p>
          </>
        ) : (
          <>
            <CreatureCard
              kind={kind}
              name={enemy?.name}
              health={enemy?.health ?? ally?.health ?? creature.health}
              maxHealth={enemy?.maxHealth ?? creature.health}
              presentation
            />
            <CreatureDetails
              kind={kind}
              name={enemy?.name}
              health={enemy?.health ?? ally?.health ?? creature.health}
              maxHealth={enemy?.maxHealth ?? creature.health}
              cards={game.cards}
              block={enemy ? 0 : ally?.block}
              marks={enemy?.marks}
              actor={enemy ? undefined : ally}
            />
            {enemy ? (
              <p>
                <DamageValue type={enemyDamageType(game.encounter, enemy.id)} amount={enemy.damage} /> →{" "}
                {species(game.team.find((c) => c.id === enemy.targetId)!.species).name}
              </p>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function App(props: { session: Session; desktop?: boolean }) {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
      <Game {...props} />
    </TooltipProvider>
  );
}
function Game({ session, desktop = false }: { session: Session; desktop?: boolean }) {
  const view = useStore(session.store),
    game = view.game;
  const [selected, setSelected] = useState<string | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [recruit, setRecruit] = useState<SpeciesId | null>(null);
  const [mode, setMode] = useState<"keyboard" | "controller" | "pointer">("pointer");
  const [showMenu, setShowMenu] = useState(false);
  const pauseOpener = useRef<HTMLElement | null>(null);
  const setMenuOpen = useCallback((open: boolean) => {
    if (open) pauseOpener.current = document.activeElement as HTMLElement | null;
    setShowMenu(open);
  }, []);
  const [showGlossary, setShowGlossary] = useState(false);
  const glossaryOpener = useRef<HTMLButtonElement | null>(null);
  const [enemyTarget, setEnemyTarget] = useState<string | null>(null);
  const [allyTarget, setAllyTarget] = useState<string | null>(null);
  const setTarget = useCallback((id: string) => {
    if (id.startsWith("enemy-")) setEnemyTarget(id);
    else setAllyTarget(id);
  }, []);
  useEffect(() => {
    setEnemyTarget(null);
    setAllyTarget(null);
  }, [game.encounter, game.phase === "draft"]);
  const root = useRef<HTMLDivElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem("fauna.sound.enabled") !== "false";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("fauna.sound.enabled", String(soundEnabled));
    } catch {
      /* Optional preference. */
    }
  }, [soundEnabled]);
  const bursts = useCombatFeedback(session, root, soundEnabled);
  const [textScale, setTextScale] = useState(() => {
    try {
      const n = Number(localStorage.getItem("fauna.text-scale"));
      return [1, 1.25, 1.5].includes(n) ? n : 1;
    } catch {
      return 1;
    }
  });
  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", String(textScale));
    try {
      localStorage.setItem("fauna.text-scale", String(textScale));
    } catch {
      /* Preferences are optional when storage is unavailable. */
    }
  }, [textScale]);
  const forecast = useMemo(
    () => (game.phase === "battle" ? dispatch(game, { type: "endTurn" }) : null),
    [game],
  );
  const selectedCard = game.cards.find((c) => c.id === selected);
  const selectedDef = selectedCard ? definition(selectedCard.definitionId) : null;
  const targetEnemy = selectedDef?.effect === "attack" || selectedDef?.effect === "mark";
  const targetAlly = selectedDef?.effect === "guard" || selectedDef?.effect === "heal";
  const validTargets = targetEnemy
    ? (game.battle?.enemies.filter((e) => e.health > 0).map((e) => e.id) ?? [])
    : targetAlly
      ? game.team.filter((c) => c.health > 0).map((c) => c.id)
      : [];
  const rememberedTarget = targetEnemy ? enemyTarget : allyTarget;
  const targetId = validTargets.includes(rememberedTarget ?? "") ? rememberedTarget : validTargets[0];
  const preview = useMemo(
    () => (selected ? previewPlay(game, selected, targetId ?? undefined) : null),
    [game, selected, targetId],
  );
  useEffect(() => {
    if (!selected) return;
    const selector = targetId ? `[data-actor-id="${targetId}"] .creature-card` : ".confirm-play";
    root.current?.querySelector<HTMLElement>(selector)?.focus();
  }, [selected, targetId]);
  const cancelSelection = useCallback(() => {
    if (!selected) return;
    const opener = root.current?.querySelector<HTMLElement>(`[data-card-id="${selected}"]`) ?? null;
    setSelected(null);
    returnFocus(opener);
  }, [selected]);
  const send = useCallback(
    (command: Parameters<Session["command"]>[0]) => {
      if (!session.command(command)) return false;
      setSelected(null);
      setRecruit(null);
      setInspection(null);
      return true;
    },
    [session],
  );
  const action = useCallback(
    (input: InputAction) => {
      if (["left", "right", "up", "down"].includes(input)) {
        if (
          selected &&
          validTargets.length &&
          (input === "left" || input === "right") &&
          !inspection &&
          !showMenu &&
          !showGlossary
        ) {
          if ((input === "left" || input === "right") && validTargets.length) {
            const index = validTargets.indexOf(targetId ?? "");
            setTarget(
              validTargets[
                (index + (input === "left" ? -1 : 1) + validTargets.length) % validTargets.length
              ]!,
            );
          }
        } else moveFocus(input as "left" | "right" | "up" | "down");
        return;
      }
      if (input === "confirm") {
        (document.activeElement as HTMLElement | null)?.click();
        return;
      }
      if (input === "back") {
        if (showGlossary) setShowGlossary(false);
        else if (inspection) setInspection(null);
        else if (showMenu) setShowMenu(false);
        else if (selected) cancelSelection();
        else if (recruit) setRecruit(null);
        else setMenuOpen(!showMenu);
        return;
      }
      if (inspection || showMenu || showGlossary) return;
      if (input === "endTurn" && game.phase === "battle") send({ type: "endTurn" });
      if (input === "inspect") {
        const focused = document.activeElement as HTMLElement | null;
        const id = focused?.closest<HTMLElement>("[data-card-id]")?.dataset.cardId ?? selected;
        const card = game.cards.find((c) => c.id === id);
        const kind = focused?.closest<HTMLElement>("[data-species]")?.dataset.species as
          SpeciesId | undefined;
        if (card) setInspection({ card });
        else if (kind)
          setInspection({
            species: kind,
            enemyId: focused?.closest<HTMLElement>("[data-enemy-id]")?.dataset.enemyId,
          });
      }
    },
    [
      inspection,
      cancelSelection,
      setMenuOpen,
      selected,
      recruit,
      showMenu,
      showGlossary,
      validTargets,
      targetId,
      game.cards,
      game.phase,
      send,
    ],
  );
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  }, [action]);
  useEffect(() => connectInput((input) => actionRef.current(input), setMode), []);
  const focusedPhase = useRef<string | null>(null);
  useEffect(() => {
    if (showMenu || focusedPhase.current === game.phase) return;
    focusedPhase.current = game.phase;
    if (game.phase === "victory" || game.phase === "defeat")
      root.current?.querySelector<HTMLElement>(".end-screen button:not(.creature-card)")?.focus();
    else if (game.phase !== "battle" || mode !== "pointer")
      root.current?.querySelector<HTMLElement>("main button:not(:disabled)")?.focus();
  }, [game.phase, showMenu]);
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
  return (
    <div
      ref={root}
      className={`app ${game.phase === "battle" ? "in-battle" : ""}`}
      data-input={mode}
      data-selected-card={selected ?? ""}
      data-phase={game.phase}
      data-save-status={view.saveStatus}
    >
      <Button
        variant="ghost"
        size="icon"
        className="menu-button"
        aria-label="Open menu"
        onClick={() => setMenuOpen(!showMenu)}
      >
        <Menu aria-hidden="true" />
      </Button>
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
          <Button
            variant="default"
            onClick={() => (view.loadFailed ? void session.load() : session.startFresh())}
          >
            {view.loadFailed ? "Retry loading" : "Start fresh"}
          </Button>
        </main>
      ) : game.phase === "draft" ? (
        <main className="draft-screen">
          <h1>
            Choose 3 <span className="selection-count">{game.selected.length}/3</span>
          </h1>
          <div className="draft-grid">
            {SPECIES.filter((s) => game.unlocked.includes(s.id)).map((s) => (
              <article key={s.id}>
                <CreatureCard
                  kind={s.id}
                  health={s.health}
                  selected={game.selected.includes(s.id)}
                  disabled={game.selected.length === 3 && !game.selected.includes(s.id)}
                  onClick={() => send({ type: "draft", species: s.id })}
                  onInspect={() => setInspection({ species: s.id })}
                  label={`Choose ${s.name}`}
                />
              </article>
            ))}
          </div>
          <Button
            variant="default"
            className="start-run"
            disabled={game.selected.length !== 3}
            onClick={() => send({ type: "start" })}
          >
            Start run
          </Button>
        </main>
      ) : game.phase === "battle" && game.battle ? (
        <main className="battle-screen" aria-label={`Battle ${game.encounter + 1}`}>
          <div className="battle-status">
            <span>Battle {game.encounter + 1}/3</span>
            <span>Turn {game.battle.turn}</span>
          </div>
          <section className={`enemy-row ${targetEnemy ? "targeting" : ""}`} aria-label="Enemy row">
            {game.battle.enemies.map((enemy) => (
              <EnemyCard
                key={enemy.id}
                enemy={enemy}
                tooltips={!selected}
                intent={<EnemyIntent enemy={enemy} state={game} forecast={forecast} />}
                onPreview={() => {
                  if (selected && targetEnemy && enemy.health > 0) setTarget(enemy.id);
                }}
                preview={
                  selected && targetEnemy && targetId === enemy.id ? (
                    <TargetPreview before={game} result={preview} targetId={enemy.id} />
                  ) : null
                }
                feedback={<CombatFeedback bursts={bursts} targetId={enemy.id} />}
                onClick={() => {
                  if (enemy.health > 0 && selected && targetEnemy)
                    send({ type: "play", cardId: selected, targetId: enemy.id });
                  else setInspection({ species: enemy.species, enemyId: enemy.id });
                }}
                onInspect={() => setInspection({ species: enemy.species, enemyId: enemy.id })}
                label={
                  selected && targetEnemy && enemy.health > 0
                    ? `Target ${enemy.name}`
                    : `Inspect ${enemy.name}`
                }
              />
            ))}
          </section>
          <div className="target-control">
            {selected ? (
              <>
                <span className="selected-action">
                  {selectedDef?.name} · {selectedDef?.cost} mana
                  {selectedDef?.cost === game.battle.mana ? " · ends turn" : ""}
                </span>
                <Button
                  className="confirm-play"
                  disabled={!preview?.accepted}
                  onClick={() => send({ type: "play", cardId: selected, targetId: targetId ?? undefined })}
                >
                  Play{mode === "controller" ? " · A" : " · Enter"}
                </Button>
                <Button variant="outline" className="cancel-target" onClick={cancelSelection}>
                  Cancel
                </Button>
              </>
            ) : null}
          </div>
          <section className={`player-row ${targetAlly ? "targeting" : ""}`} aria-label="Player row">
            {game.team.map((c) => (
              <AllyCard
                key={c.id}
                creature={c}
                tooltips={!selected}
                cards={game.cards.filter((card) => card.ownerId === c.id)}
                selected={selectedCard?.ownerId === c.id}
                onPreview={() => {
                  if (selected && targetAlly && c.health > 0) setTarget(c.id);
                }}
                preview={
                  selected && ((targetAlly && targetId === c.id) || selectedDef?.effect === "teamGuard") ? (
                    <TargetPreview before={game} result={preview} targetId={c.id} />
                  ) : null
                }
                feedback={<CombatFeedback bursts={bursts} targetId={c.id} />}
                onClick={() => {
                  if (c.health > 0 && selected && targetAlly)
                    send({ type: "play", cardId: selected, targetId: c.id });
                  else setInspection({ species: c.species });
                }}
                onInspect={() => setInspection({ species: c.species })}
                label={
                  selected && targetAlly && c.health > 0
                    ? `Target ${species(c.species).name}`
                    : `Inspect ${species(c.species).name}`
                }
              />
            ))}
          </section>
          <section className="hand-section" aria-label="Action hand">
            <div className="hand-toolbar">
              <span className="mana-display" aria-label={`${game.battle.mana} of 3 mana`}>
                <strong>{game.battle.mana}/3</strong> Mana
              </span>
              <span className="pile-counts">
                Draw {game.battle.draw.length} · Discard {game.battle.discard.length}
              </span>
              <Button variant="default" className="end-turn" onClick={() => send({ type: "endTurn" })}>
                End turn{mode === "controller" ? <small>Y</small> : null}
              </Button>
            </div>
            <div className="hand">
              {game.battle.hand.map((id) => {
                const card = game.cards.find((c) => c.id === id)!,
                  owner = game.team.find((c) => c.id === card.ownerId)!;
                return (
                  <ActionCard
                    key={id}
                    card={card}
                    tooltips={!selected}
                    ownerName={species(owner.species).name}
                    actor={owner}
                    selected={selected === id}
                    disabled={game.battle!.mana < definition(card.definitionId).cost}
                    onInspect={() => setInspection({ card })}
                    onClick={() => {
                      if (game.battle!.mana < definition(card.definitionId).cost) {
                        setInspection({ card });
                        return;
                      }
                      setSelected((current) => (current === id ? null : id));
                    }}
                  />
                );
              })}
            </div>
          </section>
          <div className="sr-only" role="log" aria-live="polite">
            {view.events.map((e) => e.text).join(" ")}
          </div>
        </main>
      ) : game.phase === "reward" ? (
        <main className="reward-screen">
          <div className="reward-columns">
            <section aria-label="Recruit">
              <h1>Recruit</h1>
              <div className="recruit-options">
                {SPECIES.filter(
                  (s) => game.unlocked.includes(s.id) && !game.team.some((c) => c.species === s.id),
                ).map((s) => (
                  <div key={s.id}>
                    <CreatureCard
                      kind={s.id}
                      health={s.health}
                      selected={recruit === s.id}
                      onClick={() => setRecruit(s.id)}
                      onInspect={() => setInspection({ species: s.id })}
                      label={`Recruit ${s.name}`}
                    />
                  </div>
                ))}
              </div>
              {recruit ? (
                <div className="replace-options">
                  {game.team.map((c) => (
                    <Button
                      variant="outline"
                      key={c.id}
                      title="Replaces this creature and its cards, including upgrades"
                      onClick={() => send({ type: "recruit", species: recruit, replaceId: c.id })}
                    >
                      Replace {species(c.species).name}
                    </Button>
                  ))}
                  <Button variant="outline" onClick={() => setRecruit(null)}>
                    Cancel
                  </Button>
                </div>
              ) : null}
            </section>
            <section aria-label="Upgrade">
              <h1>Upgrade +2</h1>
              <div className="upgrade-options">
                {game.cards.map((card) => {
                  const def = definition(card.definitionId);
                  return (
                    <ActionCard
                      key={card.id}
                      card={card}
                      ownerName={species(def.species).name}
                      actor={{ ...game.team.find((c) => c.id === card.ownerId)!, attacked: false }}
                      label={`Upgrade ${def.name}`}
                      upgrade
                      onInspect={() => setInspection({ card })}
                      disabled={card.level >= 3}
                      onClick={() => {
                        if (card.level < 3) send({ type: "upgrade", cardId: card.id });
                      }}
                    />
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      ) : (
        <main className="end-screen">
          <h1>{game.phase === "victory" ? "Victory" : "Defeat"}</h1>
          {game.phase === "victory" && game.wins === 1 ? (
            <div className="unlock-card">
              <CreatureCard
                kind="moonhart"
                onClick={() => setInspection({ species: "moonhart" })}
                label="Inspect unlocked Moonhart"
              />
              <p>Unlocked</p>
            </div>
          ) : null}
          <Button variant="default" onClick={() => send({ type: "newRun", seed: Date.now() >>> 0 })}>
            New run
          </Button>
        </main>
      )}

      <Dialog open={showMenu} onOpenChange={setMenuOpen}>
        <DialogContent
          className="menu-panel"
          closeLabel="Close menu"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus(pauseOpener.current);
          }}
        >
          <DialogTitle className="sr-only">Pause menu</DialogTitle>
          <DialogDescription className="sr-only">Expedition settings</DialogDescription>
          <Button variant="default" onClick={() => setShowMenu(false)}>
            Resume
          </Button>
          <Button
            variant="outline"
            onClick={(event) => {
              glossaryOpener.current = event.currentTarget;
              setShowGlossary(true);
            }}
          >
            Glossary & controls
          </Button>
          <Button
            variant="outline"
            aria-label={`Text size ${textScale * 100}%`}
            onClick={() => setTextScale(textScale === 1 ? 1.25 : textScale === 1.25 ? 1.5 : 1)}
          >
            Text size {textScale * 100}%
          </Button>
          <Button
            variant="outline"
            aria-pressed={soundEnabled}
            onClick={() => setSoundEnabled((value) => !value)}
          >
            Sound {soundEnabled ? "on" : "off"}
          </Button>
          {desktop ? (
            <Button variant="outline" onClick={() => void session.quit()}>
              Save & quit
            </Button>
          ) : null}
          {["battle", "reward"].includes(game.phase) ? (
            <Button
              variant="destructive"
              onClick={() => {
                send({ type: "abandon" });
                setShowMenu(false);
              }}
            >
              End run
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      {showGlossary ? (
        <Dialog open onOpenChange={setShowGlossary}>
          <DialogContent
            className="glossary"
            closeLabel="Close glossary"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              returnFocus(glossaryOpener.current);
            }}
          >
            <DialogTitle>Glossary & controls</DialogTitle>
            <DialogDescription>
              W/A/S/D or Tab to navigate. Select a card; A/D cycles valid targets. Enter or controller A
              confirms. Escape/B cancels. I/controller X inspects. Controller Y ends the turn.
            </DialogDescription>
            <dl>
              {GLOSSARY.map((entry) => (
                <div key={entry.term}>
                  <dt>{entry.term}</dt>
                  <dd>{entry.definition}</dd>
                </div>
              ))}
            </dl>
          </DialogContent>
        </Dialog>
      ) : null}
      {inspection ? (
        <Inspector item={inspection} session={session} onClose={() => setInspection(null)} />
      ) : null}
    </div>
  );
}
