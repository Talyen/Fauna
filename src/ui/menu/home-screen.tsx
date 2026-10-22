import type { ReactNode } from "react";
import { assetUrl } from "../shared/assets";
import { ArtCard } from "../shared/cards/art-card";
import { Screen } from "../shared/navigation/screen";
export function HomeScreen({ children }: { children: ReactNode }) {
  return (
    <Screen className="home-screen menu-layout">
      <h1 className="sr-only">Fauna</h1>
      <ArtCard
        presentation
        artwork={assetUrl("logo.main-menu")}
        aspect="creature"
        className="menu-logo"
        aria-label="Fauna logo"
      />
      <nav className="menu-choices" aria-label="Main menu">
        {children}
      </nav>
    </Screen>
  );
}
