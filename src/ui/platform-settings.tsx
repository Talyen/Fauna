import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { Session } from "../application/session";
import type { DisplayState } from "../platform/ports";
import { decodeSave } from "../game/save";
import { supportTitle } from "../game/support";
import type { GameState } from "../game/types";
import { BIOMES } from "../game/destinations";
import { Button } from "../components/ui/button";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
export function DisplaySettings({ session }: { session: Session }) {
  const port = session.display;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [state, setState] = useState<DisplayState>({ mode: "windowed" });
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    if (!port) return;
    let live = true;
    let notified = false;
    const off = port.subscribe((value) => {
      notified = true;
      if (live) {
        setState(value);
        setBusy(false);
      }
    });
    void port
      .read()
      .then((value) => {
        if (live && !notified) setState(value);
      })
      .catch(() => {
        if (live) setState({ mode: "windowed", error: "Display preferences unavailable." });
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
      off();
    };
  }, [port]);
  if (!port) return null;
  return (
    <section>
      <h3>Display mode</h3>
      <RadioGroup
        aria-label="Display mode"
        orientation="horizontal"
        value={state.mode}
        disabled={busy}
        onValueChange={(value) => {
          if (value !== "windowed" && value !== "fullscreen") return;
          setBusy(true);
          void port
            .set(value)
            .then((next) => {
              if (mounted.current) setState(next);
            })
            .catch(() => {
              if (mounted.current) setState((old) => ({ ...old, error: "Could not change display mode." }));
            })
            .finally(() => {
              if (mounted.current) setBusy(false);
            });
        }}
      >
        {(["windowed", "fullscreen"] as const).map((value) => (
          <label className="text-size-option" key={value}>
            <RadioGroupItem value={value} aria-label={value === "windowed" ? "Windowed" : "Fullscreen"} />
            {value === "windowed" ? "Windowed" : "Fullscreen"}
          </label>
        ))}
      </RadioGroup>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </section>
  );
}
export function CloudStatus({ session }: { session: Session }) {
  const cloud = useStore(session.store, (s) => s.cloud);
  return (
    <section>
      <h3>Steam Cloud</h3>
      <p role="status">{cloud.status}</p>
      {cloud.error ? <p>{cloud.error}</p> : null}
      {["Pending", "Conflict"].includes(cloud.status) ? (
        <Button variant="outline" onClick={() => void session.cloud.retry()}>
          Retry cloud sync
        </Button>
      ) : null}
    </section>
  );
}
function phaseLabel(game: GameState) {
  if (game.phase === "support" && game.support) return supportTitle(game.support.kind);
  return {
    draft: "Choose a starter",
    teamSelection: "Destinations",
    battle: "Battle",
    recruit: "Recruitment",
    boon: "Boon reward",
    campfire: "Campfire",
    support: "Support visit",
    victory: "Journey complete",
    defeat: "Journey ended",
  }[game.phase];
}
export function CloudRecovery({ session }: { session: Session }) {
  const cloud = useStore(session.store, (s) => s.cloud);
  return (
    <main className="recovery">
      <h1>
        {cloud.importAvailable
          ? "Steam progress"
          : cloud.status === "Conflict"
            ? "Choose a save"
            : "Steam Cloud"}
      </h1>
      {cloud.importAvailable ? (
        <>
          <p>Use your standalone progress for this Steam profile? The original remains available offline.</p>
          <Button
            disabled={cloud.status === "Syncing"}
            onClick={() => void session.cloud.importStandalone(true)}
          >
            Use this progress
          </Button>
          <Button
            disabled={cloud.status === "Syncing"}
            variant="outline"
            onClick={() => void session.cloud.importStandalone(false)}
          >
            Start a separate Steam profile
          </Button>
        </>
      ) : (
        <>
          <p role="status">
            {cloud.error ||
              (cloud.status === "Conflict"
                ? "These journeys differ. Choose which save to continue, or play offline."
                : "Checking saved progress…")}
          </p>
          {cloud.candidates.map((candidate, index) => {
            const game = decodeSave(candidate.payload);
            return (
              <section key={candidate.id}>
                <h2>
                  Save {index + 1} · Device {candidate.device.slice(0, 6)}
                </h2>
                <p>
                  {game.expedition ? BIOMES[game.expedition.biome]!.name : "Journey"} · {phaseLabel(game)} ·{" "}
                  {game.currency} currency · {game.wins} wins
                </p>
                <Button
                  disabled={cloud.status !== "Conflict"}
                  onClick={() => void session.cloud.choose(candidate.id)}
                >
                  Use save {index + 1}
                </Button>
              </section>
            );
          })}
          {cloud.offlineAvailable ? (
            <>
              <Button variant="outline" onClick={() => session.cloud.offline()}>
                Play offline
              </Button>
              {cloud.status !== "Conflict" ? (
                <Button onClick={() => void session.cloud.retry()}>Retry cloud sync</Button>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
