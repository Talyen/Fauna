import { VisualEffectsProvider } from "./shared/effects/effects";
import type { Session } from "../application/session";
import { TooltipProvider } from "../components/ui/tooltip";
import { GameShell } from "./shell/game-shell";
export function App(props: { session: Session }) {
  return (
    <TooltipProvider>
      <VisualEffectsProvider>
        <GameShell {...props} />
      </VisualEffectsProvider>
    </TooltipProvider>
  );
}
