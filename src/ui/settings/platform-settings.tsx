import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "../../components/ui/select";
import { useMessages } from "../shared/localization/message-context";
import { Loading } from "../shared/loading";
import { useEffect, useRef, useState } from "react";
import type { Session } from "../../application/session";
import type { DisplayState } from "../../platform/ports";

export function DisplaySettings({ session }: { session: Session }) {
  const i18n = useMessages();
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
      .catch((error) => {
        session.diagnostics.record("global", error);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
      off();
    };
  }, [port, session]);
  if (!port) return null;
  return (
    <section>
      <h3 className="settings-heading">{i18n.message("settings.displayMode", "Display mode")}</h3>
      <Select
        value={state.mode}
        disabled={busy}
        onValueChange={(value) => {
          if (value !== "windowed" && value !== "fullscreen" && value !== "borderless-fullscreen") return;
          setBusy(true);
          void port
            .set(value)
            .then((next) => {
              if (mounted.current) setState(next);
            })
            .catch((error) => session.diagnostics.record("global", error))
            .finally(() => {
              if (mounted.current) setBusy(false);
            });
        }}
      >
        <SelectTrigger aria-label={i18n.message("settings.displayMode", "Display mode")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="windowed">{i18n.message("settings.windowed", "Windowed")}</SelectItem>
          <SelectItem value="borderless-fullscreen">
            {i18n.message("settings.borderless", "Borderless Fullscreen")}
          </SelectItem>
          <SelectItem value="fullscreen">{i18n.message("settings.fullscreen", "Fullscreen")}</SelectItem>
        </SelectContent>
      </Select>
      {busy ? <Loading /> : null}
    </section>
  );
}
