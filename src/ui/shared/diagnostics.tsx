import { Screen } from "./navigation/screen";
import { Component, type ReactNode } from "react";
import type { Diagnostics } from "../../application/diagnostics";
import { Loading } from "./loading";
export class GameErrorBoundary extends Component<
  { diagnostics: Diagnostics; children: ReactNode; onRetry?: () => void; onFailure?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  private retry: ReturnType<typeof setTimeout> | undefined;
  private recovered: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onFailure?.();
    this.props.diagnostics.record("render", error);
    clearTimeout(this.recovered);
    this.attempts++;
    this.retry = setTimeout(
      () => {
        this.props.onRetry?.();
        this.recovered = setTimeout(() => {
          this.attempts = 0;
        }, 30000);
        this.setState({ failed: false });
      },
      Math.min(1000 * 2 ** Math.min(this.attempts - 1, 5), 30000),
    );
  }
  componentWillUnmount() {
    clearTimeout(this.retry);
    clearTimeout(this.recovered);
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
