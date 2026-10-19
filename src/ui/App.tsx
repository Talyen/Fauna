import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { AnimatePresence, motion } from "motion/react";
import type { Session } from "../application/session";
import { CARDS, ENCOUNTERS, SPECIES, cardText, definition, species } from "../game/content";
import type { SpeciesId } from "../game/content";
import { ActionCard, AllyCard, CreatureCard, EnemyCard } from "./cards";
import { connectInput, moveFocus } from "./input";
import type { InputAction } from "./input";
import type { Card } from "../game/types";

function Inspection({ card, onClose }: { card: Card; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const def = definition(card.definitionId),
    owner = species(def.species);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="inspection"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label={`${def.name} details`}
    >
      <div className="inspection-content">
        <div className="inspection-art">
          <ActionCard card={card} ownerName={owner.name} onClick={() => {}} presentation />
        </div>
        <div>
          <p className="eyebrow">
            {owner.name} · {def.cost} energy
          </p>
          <h2>
            {def.name}
            {card.level ? ` +${card.level}` : ""}
          </h2>
          <p>{cardText(def, card.level)}</p>
          <div className="trait-detail">
            <strong>{owner.trait}</strong>
            <p>{owner.description}</p>
          </div>
          <button className="primary" onClick={onClose} autoFocus>
            Close inspection
          </button>
        </div>
      </div>
    </dialog>
  );
}
export function App({ session, desktop = false }: { session: Session; desktop?: boolean }) {
  const view = useStore(session.store);
  const game = view.game;
  const [selected, setSelected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<Card | null>(null);
  const [recruit, setRecruit] = useState<SpeciesId | null>(null);
  const [mode, setMode] = useState<"keyboard" | "controller" | "pointer">("pointer");
  const [showMenu, setShowMenu] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [subject, setSubject] = useState<{ species: SpeciesId; enemyId?: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const send = useCallback(
    (command: Parameters<Session["command"]>[0]) => {
      const accepted = session.command(command);
      if (accepted) {
        setSelected(null);
        setRecruit(null);
        setSubject(null);
      }
      return accepted;
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
        if (inspected) setInspected(null);
        else if (selected) setSelected(null);
        else if (recruit) setRecruit(null);
        else if (subject) setSubject(null);
        else if (showJournal) setShowJournal(false);
        else setShowMenu((value) => !value);
        return;
      }
      if (document.querySelector("dialog[open]") || showMenu || showJournal) return;
      if (input === "endTurn" && game.phase === "battle") send({ type: "endTurn" });
      if (input === "inspect") {
        const focused = (document.activeElement as HTMLElement)?.closest<HTMLElement>("[data-card-id]")
          ?.dataset.cardId;
        const card = game.cards.find((c) => c.id === (focused ?? selected));
        if (card) setInspected(card);
      }
    },
    [game.cards, game.phase, inspected, recruit, selected, send, showJournal, showMenu, subject],
  );
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  }, [action]);
  useEffect(() => connectInput((input) => actionRef.current(input), setMode), []);
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("main button:not(:disabled)")?.focus();
  }, [game.phase, showMenu, showJournal]);
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (session.store.getState().saveStatus !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [session]);
  const selectedCard = game.cards.find((c) => c.id === selected);
  const selectedDef = selectedCard ? definition(selectedCard.definitionId) : null;
  const subjectEnemy = game.battle?.enemies.find((e) => e.id === subject?.enemyId);
  const targetEnemy = selectedDef?.effect === "attack" || selectedDef?.effect === "mark";
  const targetAlly = selectedDef?.effect === "heal" || selectedDef?.effect === "guard";
  const nextRun = () => {
    send({ type: "newRun", seed: Date.now() >>> 0 });
    setShowMenu(false);
  };
  if (!view.ready) return <div className="loading">Opening your field journal…</div>;
  return (
    <div ref={root} className={`app ${game.phase === "battle" ? "in-battle" : ""}`} data-input={mode}>
      <header className="topbar">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowMenu((v) => !v);
          }}
          aria-label="Fauna menu"
        >
          <span className="brand-mark">✳</span> FAUNA<span className="brand-edition">THE VERDANT WILDS</span>
        </a>
        <div className="expedition-path" aria-label={`Encounter ${game.encounter + 1} of 3`}>
          <span className={game.encounter === 0 ? "active" : ""}>
            01 <small>THE TRAIL</small>
          </span>
          <i />
          <span className={game.encounter === 1 ? "active" : ""}>
            02 <small>FERNWOOD</small>
          </span>
          <i />
          <span className={game.encounter === 2 ? "active" : ""}>
            03 <small>THE CROWN</small>
          </span>
        </div>
        <div className="top-actions">
          <span className={`save-status ${view.saveStatus}`} role="status">
            {view.saveStatus === "saved"
              ? "◌ Saved"
              : view.saveStatus === "saving"
                ? "Saving…"
                : "Save failed"}
          </span>
          <button className="quiet" onClick={() => setShowJournal((v) => !v)}>
            Journal
          </button>
          <button className="menu-button" aria-label="Open menu" onClick={() => setShowMenu((v) => !v)}>
            ☰
          </button>
        </div>
      </header>
      {view.notice ? (
        <div className="notice" role="status">
          {view.notice}
        </div>
      ) : null}
      {view.error ? (
        <div className="error-banner" role="alert">
          {view.error}
          {view.saveStatus === "error" ? (
            <button onClick={() => session.retrySave()}>Retry save</button>
          ) : null}
        </div>
      ) : null}
      {view.loadFailed || view.recoveryRequired ? (
        <main className="recovery">
          <h1>A page out of place</h1>
          <p>{view.loadFailed ? view.error : view.notice}</p>
          <button
            className="primary"
            onClick={() => (view.loadFailed ? void session.load() : session.startFresh())}
          >
            {view.loadFailed ? "Retry loading" : "Start fresh"}
          </button>
        </main>
      ) : showMenu ? (
        <main className="menu-panel">
          <p className="eyebrow">A MOMENT IN THE WILDS</p>
          <h1>Take a breath.</h1>
          <button className="primary" onClick={() => setShowMenu(false)}>
            Return to game
          </button>
          {["battle", "reward"].includes(game.phase) ? (
            <button
              className="secondary"
              onClick={() => {
                send({ type: "abandon" });
                setShowMenu(false);
              }}
            >
              End expedition
            </button>
          ) : null}
          {["victory", "defeat"].includes(game.phase) ? (
            <button className="secondary" onClick={nextRun}>
              New expedition
            </button>
          ) : null}
          {desktop ? (
            <button className="secondary" onClick={() => void session.quit()}>
              Save & quit
            </button>
          ) : null}
        </main>
      ) : showJournal ? (
        <main className="journal">
          <p className="eyebrow">FIELD JOURNAL · {game.unlocked.length} / 6 DISCOVERED</p>
          <h1>Familiar faces. New possibilities.</h1>
          <div className="journal-grid">
            {SPECIES.map((s) => (
              <article key={s.id} className={game.unlocked.includes(s.id) ? "" : "undiscovered"}>
                <CreatureCard
                  kind={s.id}
                  disabled={!game.unlocked.includes(s.id)}
                  onClick={() => setSubject({ species: s.id })}
                  label={`Inspect ${s.name}`}
                />
                <h3>{game.unlocked.includes(s.id) ? s.name : "Undiscovered"}</h3>
                <p>
                  {game.unlocked.includes(s.id)
                    ? `${s.trait}: ${s.description}`
                    : "Complete an expedition to reveal this creature."}
                </p>
              </article>
            ))}
          </div>
          <button className="primary" onClick={() => setShowJournal(false)}>
            Return to expedition
          </button>
        </main>
      ) : game.phase === "draft" ? (
        <main className="draft-screen">
          <div className="section-heading">
            <p className="eyebrow">YOUR FIRST STEPS INTO THE UNKNOWN</p>
            <h1>
              A little wild.
              <br />
              <em>Better together.</em>
            </h1>
            <p className="intro">
              Three companions. One shared deck.
              <br />
              Find the spark between them.
            </p>
          </div>
          <div className="draft-grid">
            {SPECIES.filter((s) => game.unlocked.includes(s.id)).map((s) => (
              <article className={`draft-option ${game.selected.includes(s.id) ? "chosen" : ""}`} key={s.id}>
                <CreatureCard
                  kind={s.id}
                  selected={game.selected.includes(s.id)}
                  disabled={game.selected.length === 3 && !game.selected.includes(s.id)}
                  onClick={() => send({ type: "draft", species: s.id })}
                  label={`Choose ${s.name}`}
                />
                <div className="draft-info">
                  <span>{s.health} ♥</span>
                  <strong>{s.trait}</strong>
                  <p>{s.description}</p>
                  <div className="mini-moves">
                    {CARDS.filter((c) => c.species === s.id).map((c) => (
                      <span key={c.id} title={cardText(c)}>
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="draft-footer">
            <span className="selection-count">
              {game.selected.length} <span>/ 3 companions chosen</span>
            </span>
            <button
              className="primary"
              disabled={game.selected.length !== 3}
              onClick={() => send({ type: "start" })}
            >
              Enter the wilds <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className="prototype-note">
            A playable field study · placeholder artwork · single-player & offline
          </p>
        </main>
      ) : game.phase === "battle" && game.battle ? (
        <main className="battle-screen">
          <div className="battle-heading">
            <div>
              <p className="eyebrow">EXPEDITION {String(game.encounter + 1).padStart(2, "0")} / 03</p>
              <h1>{ENCOUNTERS[game.encounter]!.name}</h1>
            </div>
            <div className="turn-label">
              TURN <strong>{game.battle.turn}</strong>
            </div>
          </div>
          <section className={`enemy-row ${targetEnemy ? "targeting" : ""}`} aria-label="Enemy row">
            {game.battle.enemies.map((enemy) => (
              <EnemyCard
                key={enemy.id}
                enemy={enemy}
                intent={`Attack ${enemy.damage} → ${species(game.team.find((c) => c.id === enemy.targetId)!.species).name}`}
                onClick={() => {
                  if (selected && targetEnemy) send({ type: "play", cardId: selected, targetId: enemy.id });
                  else setSubject({ species: enemy.species, enemyId: enemy.id });
                }}
                label={selected && targetEnemy ? `Target ${enemy.name}` : `Inspect ${enemy.name}`}
              />
            ))}
          </section>
          <div className="battle-divider">
            <span />
            <p>
              {selectedDef
                ? `${selectedDef.name} · Choose ${targetEnemy ? "an enemy" : "an ally"}`
                : "YOUR COMPANIONS"}
              {selected ? (
                <button className="cancel-target" onClick={() => setSelected(null)}>
                  Cancel
                </button>
              ) : null}
            </p>
            <span />
          </div>
          <section className={`player-row ${targetAlly ? "targeting" : ""}`} aria-label="Player row">
            {game.team.map((creature) => (
              <AllyCard
                key={creature.id}
                creature={creature}
                selected={selectedCard?.ownerId === creature.id}
                onClick={() => {
                  if (selected && targetAlly) send({ type: "play", cardId: selected, targetId: creature.id });
                  else setSubject({ species: creature.species });
                }}
                label={
                  selected && targetAlly
                    ? `Target ${species(creature.species).name}`
                    : `Inspect ${species(creature.species).name}`
                }
              />
            ))}
          </section>
          <section className="hand-section" aria-label="Action hand">
            <div className="hand-toolbar">
              <div className="energy-display">
                <span className="energy-orb">{game.battle.energy}</span>
                <div>
                  <strong>ENERGY</strong>
                  <small>of 3 this turn</small>
                </div>
              </div>
              <p className="hand-help">
                {mode === "controller"
                  ? "A Select · B Back · X Inspect"
                  : mode === "keyboard"
                    ? "Arrows Navigate · Enter Select · I Inspect"
                    : "Choose a card, then its target"}
                {selectedCard ? (
                  <button className="text-button" onClick={() => setInspected(selectedCard)}>
                    Inspect card
                  </button>
                ) : null}
              </p>
              <button
                className="end-turn"
                onClick={() => {
                  setSelected(null);
                  send({ type: "endTurn" });
                }}
              >
                End turn <span aria-hidden="true">→</span>
                {mode === "controller" ? <small>Y</small> : null}
              </button>
            </div>
            <div className="hand">
              {game.battle.hand.map((id) => {
                const card = game.cards.find((c) => c.id === id)!;
                const owner = game.team.find((c) => c.id === card.ownerId)!;
                return (
                  <div className="hand-slot" key={id}>
                    <ActionCard
                      card={card}
                      ownerName={species(owner.species).name}
                      selected={selected === id}
                      disabled={game.battle!.energy < definition(card.definitionId).cost}
                      onClick={() => {
                        if (game.battle!.energy < definition(card.definitionId).cost) {
                          setInspected(card);
                          return;
                        }
                        if (definition(card.definitionId).effect === "teamGuard")
                          send({ type: "play", cardId: id });
                        else setSelected((current) => (current === id ? null : id));
                      }}
                    />
                    <button
                      className="card-inspect"
                      aria-label={`Inspect ${definition(card.definitionId).name}`}
                      title="Inspect card (I)"
                      onClick={() => setInspected(card)}
                    >
                      ⌕
                    </button>
                  </div>
                );
              })}
              {!game.battle.hand.length ? (
                <p className="empty-hand">Your hand is empty. End your turn to draw again.</p>
              ) : null}
            </div>
            <div className="pile-counts">
              <span>
                DRAW <strong>{game.battle.draw.length}</strong>
              </span>
              <span>
                DISCARD <strong>{game.battle.discard.length}</strong>
              </span>
              <span className="seed-label">OFFLINE · FIELD STUDY</span>
            </div>
          </section>
        </main>
      ) : game.phase === "reward" ? (
        <main className="reward-screen">
          <div className="section-heading">
            <p className="eyebrow">TRAIL CLEARED · THE TEAM IS RESTORED</p>
            <h1>
              Room to <em>grow.</em>
            </h1>
            <p className="intro">Recruit a new companion or strengthen one card.</p>
          </div>
          <div className="reward-columns">
            <section>
              <h2>
                01 <span>A new companion</span>
              </h2>
              <p>Replace a teammate and their cards. New cards begin without upgrades.</p>
              <div className="recruit-options">
                {SPECIES.filter(
                  (s) => game.unlocked.includes(s.id) && !game.team.some((c) => c.species === s.id),
                ).map((s) => (
                  <CreatureCard
                    key={s.id}
                    kind={s.id}
                    selected={recruit === s.id}
                    onClick={() => setRecruit(s.id)}
                    label={`Recruit ${s.name}`}
                  />
                ))}
              </div>
              {recruit ? (
                <div className="replace-options">
                  <h3>
                    {species(recruit).name} · {species(recruit).trait}
                  </h3>
                  <p>{species(recruit).description} Who will return home?</p>
                  {game.team.map((c) => (
                    <button
                      className="secondary"
                      key={c.id}
                      onClick={() => send({ type: "recruit", species: recruit, replaceId: c.id })}
                    >
                      Replace {species(c.species).name}
                    </button>
                  ))}
                  <button className="quiet" onClick={() => setRecruit(null)}>
                    Cancel recruitment
                  </button>
                </div>
              ) : null}
            </section>
            <section>
              <h2>
                02 <span>A stronger bond</span>
              </h2>
              <p>Add +2 to a card’s effect. Upgrades last for this expedition.</p>
              <div className="upgrade-options">
                {game.cards.map((c) => {
                  const def = definition(c.definitionId);
                  return (
                    <button
                      key={c.id}
                      disabled={c.level >= 3}
                      onClick={() => send({ type: "upgrade", cardId: c.id })}
                      aria-label={`Upgrade ${def.name}`}
                    >
                      <img src={`./art/${def.species}-action.svg`} alt="" />
                      <span>
                        <strong>
                          {def.name}
                          {c.level ? ` +${c.level}` : ""}
                        </strong>
                        <small>{cardText(def, c.level)}</small>
                      </span>
                      <b>+2 ↗</b>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      ) : (
        <main className="end-screen">
          <div className="end-emblem">{game.phase === "victory" ? "✳" : "❧"}</div>
          <p className="eyebrow">{game.phase === "victory" ? "EXPEDITION COMPLETE" : "EXPEDITION ENDED"}</p>
          <h1>
            {game.phase === "victory" ? (
              <>
                The wilds remember
                <br />
                <em>your kindness.</em>
              </>
            ) : (
              <>
                Every trail teaches
                <br />
                <em>something new.</em>
              </>
            )}
          </h1>
          <p className="intro">
            {game.phase === "victory"
              ? "Moonhart is now part of your roster. A new team awaits."
              : "Your discoveries remain in the field journal. Try a new team."}
          </p>
          {game.phase === "victory" ? (
            <div className="unlock-card">
              <CreatureCard
                kind="moonhart"
                onClick={() => setSubject({ species: "moonhart" })}
                label="Inspect unlocked Moonhart"
              />
              <p>ROSTER UNLOCK · MOONHART</p>
            </div>
          ) : null}
          <button className="primary" onClick={nextRun}>
            Begin another expedition ↗
          </button>
        </main>
      )}
      {subject ? (
        <div className="subject-banner" role="status">
          <strong>
            {subjectEnemy
              ? subjectEnemy.name
              : `${species(subject.species).name} · ${species(subject.species).trait}`}
          </strong>
          <span>
            {subjectEnemy
              ? `${subjectEnemy.health} health. Next attack: ${subjectEnemy.damage} damage to ${species(game.team.find((c) => c.id === subjectEnemy.targetId)!.species).name}.`
              : species(subject.species).description}
          </span>
          <button className="quiet" onClick={() => setSubject(null)}>
            Close
          </button>
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        {view.events.length && game.phase === "battle" ? (
          <motion.div
            key={game.revision}
            className="combat-feed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="log"
            aria-live="polite"
          >
            {view.events
              .filter((e) => e.kind !== "action")
              .slice(-2)
              .map((e, i) => (
                <span key={i}>{e.text}</span>
              ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <footer className="app-footer">
        <span>
          FAUNA <i> / </i> FIELD STUDY 001
        </span>
        <span>
          {mode === "controller" ? "D-PAD Navigate · A Confirm · B Back" : "ESC Menu / Back"} <i>·</i>{" "}
          {game.unlocked.length} creatures discovered
        </span>
      </footer>
      {inspected ? <Inspection card={inspected} onClose={() => setInspected(null)} /> : null}
    </div>
  );
}
