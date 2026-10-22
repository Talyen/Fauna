import type { Session } from "../application/session";
import { TooltipProvider } from "../components/ui/tooltip";
import { GameShell } from "./shell/game-shell";
export function App(props: { session: Session; desktop?: boolean }) {
  return (
    <TooltipProvider>
      <GameShell {...props} />
    </TooltipProvider>
  );
}
