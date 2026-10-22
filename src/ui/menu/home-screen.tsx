import type { ReactNode } from "react";
import { Screen } from "../shared/navigation/screen";
export function HomeScreen({ children }: { children: ReactNode }) {
  return (
    <Screen className="home-screen menu-layout">
      <h1 className="menu-title">Fauna</h1>
      <nav className="menu-choices" aria-label="Main menu">
        {children}
      </nav>
    </Screen>
  );
}
