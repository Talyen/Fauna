import { Screen } from "./screen";
import { Component, type ReactNode } from "react";
import type { Diagnostics } from "../../application/diagnostics";
import { Loading } from "./loading";
export class GameErrorBoundary extends Component<
  { diagnostics: Diagnostics; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  private retry: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.diagnostics.record("render", error);
    this.retry = setTimeout(
      () => this.setState({ failed: false }),
      Math.min(1000 * 2 ** Math.min(this.attempts++, 5), 30000),
    );
  }
  componentWillUnmount() {
    clearTimeout(this.retry);
  }
  render() {
    return this.state.failed ? (
      <Screen className="loading">
        <Loading />
      </Screen>
    ) : (
      this.props.children
    );
  }
}
