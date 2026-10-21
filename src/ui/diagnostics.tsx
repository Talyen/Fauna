import { Component, type ReactNode } from "react";
import type { Diagnostics } from "../application/diagnostics";

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
      </main>
    ) : (
      this.props.children
    );
  }
}
