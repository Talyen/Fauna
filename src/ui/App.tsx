import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { Session } from "../application/session";
import { Menu } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { DamageValue, CardRules } from "./combat-values";
import { CARDS, SPECIES, definition, species, enemyDamageType } from "../game/content";
import type { SpeciesId } from "../game/content";
import { ActionCard, AllyCard, CreatureCard, EnemyCard } from "./cards";
import { connectInput, moveFocus } from "./input";
import type { InputAction } from "./input";
import type { Card } from "../game/types";

type Inspection = { card: Card } | { species: SpeciesId; enemyId?: string };
function Inspector({ item, session, onClose }: { item: Inspection; session: Session; onClose: () => void }) {
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const game = useStore(session.store, (s) => s.game);
  const kind = "card" in item ? definition(item.card.definitionId).species : item.species;
  const creature = species(kind);
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
          if (opener?.isConnected) opener.focus();
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
            <p className="trait-description">{creature.description}</p>
          </>
        ) : (
          <>
            <CreatureCard
              kind={kind}
              name={enemy?.name}
              health={enemy?.health ?? creature.health}
              maxHealth={enemy?.maxHealth ?? creature.health}
              presentation
            />
            {enemy ? (
              <p>
                <DamageValue type={enemyDamageType(game.encounter, enemy.id)} amount={enemy.damage} /> →{" "}
                {species(game.team.find((c) => c.id === enemy.targetId)!.species).name}
              </p>
            ) : (
              <>
                <p className="trait-description">{creature.description}</p>
                <div className="inspection-cards">
                  {CARDS.filter((c) => c.species === kind).map((def) => (
                    <ActionCard
                      key={def.id}
                      card={
                        game.cards.find((c) => c.definitionId === def.id) ?? {
                          id: def.id,
                          definitionId: def.id,
                          ownerId: kind,
                          level: 0,
                        }
                      }
                      ownerName={creature.name}
                      onClick={() => {}}
                      presentation
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function App({ session, desktop = false }: { session: Session; desktop?: boolean }) {
  const view = useStore(session.store),
    game = view.game;
  const [selected, setSelected] = useState<string | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [recruit, setRecruit] = useState<SpeciesId | null>(null);
  const [mode, setMode] = useState<"keyboard" | "controller" | "pointer">("pointer");
  const [showMenu, setShowMenu] = useState(false);
  const root = useRef<HTMLDivElement>(null);
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
        moveFocus(input as "left" | "right" | "up" | "down");
        return;
      }
      if (input === "confirm") {
        (document.activeElement as HTMLElement | null)?.click();
        return;
      }
      if (input === "back") {
        if (inspection) setInspection(null);
        else if (selected) setSelected(null);
        else if (recruit) setRecruit(null);
        else setShowMenu((v) => !v);
        return;
      }
      if (inspection || showMenu) return;
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
    [inspection, selected, recruit, showMenu, game.cards, game.phase, send],
  );
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  }, [action]);
  useEffect(() => connectInput((input) => actionRef.current(input), setMode), []);
  useEffect(() => {
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
  const selectedCard = game.cards.find((c) => c.id === selected);
  const selectedDef = selectedCard ? definition(selectedCard.definitionId) : null;
  const targetEnemy = selectedDef?.effect === "attack" || selectedDef?.effect === "mark";
  const targetAlly = selectedDef?.effect === "guard" || selectedDef?.effect === "heal";
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
      data-phase={game.phase}
      data-save-status={view.saveStatus}
    >
      <Button
        variant="ghost"
        size="icon"
        className="menu-button"
        aria-label="Open menu"
        onClick={() => setShowMenu((v) => !v)}
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
      ) : showMenu ? (
        <main className="menu-panel" aria-label="Pause menu">
          <Button variant="default" onClick={() => setShowMenu(false)}>
            Resume
          </Button>
          {["battle", "reward"].includes(game.phase) ? (
            <Button
              variant="outline"
              onClick={() => {
                send({ type: "abandon" });
                setShowMenu(false);
              }}
            >
              End run
            </Button>
          ) : null}
          {desktop ? (
            <Button variant="outline" onClick={() => void session.quit()}>
              Save & quit
            </Button>
          ) : null}
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
                <p className="trait-description">{s.description}</p>
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
                intent={
                  <>
                    <DamageValue type={enemyDamageType(game.encounter, enemy.id)} amount={enemy.damage} /> →{" "}
                    {species(game.team.find((c) => c.id === enemy.targetId)!.species).name}
                  </>
                }
                onClick={() => {
                  if (selected && targetEnemy) send({ type: "play", cardId: selected, targetId: enemy.id });
                  else setInspection({ species: enemy.species, enemyId: enemy.id });
                }}
                onInspect={() => setInspection({ species: enemy.species, enemyId: enemy.id })}
                label={selected && targetEnemy ? `Target ${enemy.name}` : `Inspect ${enemy.name}`}
              />
            ))}
          </section>
          <div className="target-control">
            {selected ? (
              <Button variant="outline" className="cancel-target" onClick={() => setSelected(null)}>
                Cancel
              </Button>
            ) : null}
          </div>
          <section className={`player-row ${targetAlly ? "targeting" : ""}`} aria-label="Player row">
            {game.team.map((c) => (
              <AllyCard
                key={c.id}
                creature={c}
                selected={selectedCard?.ownerId === c.id}
                onClick={() => {
                  if (selected && targetAlly) send({ type: "play", cardId: selected, targetId: c.id });
                  else setInspection({ species: c.species });
                }}
                onInspect={() => setInspection({ species: c.species })}
                label={
                  selected && targetAlly
                    ? `Target ${species(c.species).name}`
                    : `Inspect ${species(c.species).name}`
                }
              />
            ))}
          </section>
          <section className="hand-section" aria-label="Action hand">
            <div className="hand-toolbar">
              <span className="energy-display" aria-label={`${game.battle.energy} of 3 energy`}>
                <strong>{game.battle.energy}/3</strong> Energy
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
                    ownerName={species(owner.species).name}
                    selected={selected === id}
                    disabled={game.battle!.energy < definition(card.definitionId).cost}
                    onInspect={() => setInspection({ card })}
                    onClick={() => {
                      if (game.battle!.energy < definition(card.definitionId).cost) {
                        setInspection({ card });
                        return;
                      }
                      if (definition(card.definitionId).effect === "teamGuard")
                        send({ type: "play", cardId: id });
                      else setSelected((current) => (current === id ? null : id));
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
                    <p className="trait-description">{s.description}</p>
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
                    <Button
                      variant="outline"
                      key={card.id}
                      disabled={card.level >= 3}
                      onClick={() => send({ type: "upgrade", cardId: card.id })}
                      aria-label={`Upgrade ${def.name}`}
                    >
                      <strong>
                        {def.name}
                        {card.level ? ` +${card.level}` : ""}
                      </strong>
                      <span>
                        <CardRules card={def} level={card.level} />{" "}
                        <b>→ {def.value + (card.level + 1) * 2}</b>
                      </span>
                    </Button>
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
      {inspection ? (
        <Inspector item={inspection} session={session} onClose={() => setInspection(null)} />
      ) : null}
    </div>
  );
}
