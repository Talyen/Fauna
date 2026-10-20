import { Component, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Diagnostics } from "../application/diagnostics";
import { Button } from "../components/ui/button";

export function DiagnosticViewer({ diagnostics, desktop }: { diagnostics: Diagnostics; desktop: boolean }) {
  const entries = useSyncExternalStore(diagnostics.subscribe, diagnostics.snapshot);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="diagnostic-viewer" data-nav-row aria-label="Local diagnostics">
      <Button variant="ghost" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        Diagnostics
      </Button>
      <div id={id} hidden={!open}>
        <Button
          variant="outline"
          onClick={() =>
            void diagnostics.copy(desktop ? "desktop" : "browser").then(
              () => setStatus("Diagnostics copied."),
              () => setStatus("Could not copy. Select the report text to copy it manually."),
            )
          }
        >
          Copy diagnostics
        </Button>
        <p role="status">{status}</p>
        {entries.length || status.startsWith("Could not copy") ? (
          <pre tabIndex={0}>{diagnostics.report(desktop ? "desktop" : "browser")}</pre>
        ) : (
          <p>No errors recorded.</p>
        )}
      </div>
    </section>
  );
}

export class GameErrorBoundary extends Component<
  { diagnostics: Diagnostics; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.diagnostics.record("render", error);
  }
  render() {
    return this.state.failed ? (
      <main className="recovery">
        <h1>Fauna could not continue</h1>
        <p>Close and reopen the game to retry.</p>
        <DiagnosticViewer diagnostics={this.props.diagnostics} desktop={!!window.faunaDesktop} />
      </main>
    ) : (
      this.props.children
    );
  }
}
