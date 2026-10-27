import { useMessages } from "./localization/message-context";
import { Screen } from "./navigation/screen";
import { Component, type ReactNode } from "react";
import type { Diagnostics } from "../../application/diagnostics";
import { Loading } from "./loading";
function RecoveryNotice() {
  const i18n = useMessages();
  return (
    <p role="status">
      {i18n.message("recovery.display", "Fauna could not display this screen; trying again…")}
    </p>
  );
}
export class GameErrorBoundary extends Component<
  { diagnostics: Diagnostics; children: ReactNode },
  { failed: boolean; persistent: boolean }
> {
  state = { failed: false, persistent: false };
  private retry: ReturnType<typeof setTimeout> | undefined;
  private recovered: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.diagnostics.record("render", error);
    clearTimeout(this.recovered);
    this.attempts++;
    this.setState({ persistent: this.attempts >= 3 });
    this.retry = setTimeout(
      () => {
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
      <Screen className="loading">{this.state.persistent ? <RecoveryNotice /> : <Loading />}</Screen>
    ) : (
      this.props.children
    );
  }
}
