import { useMessages } from "../shared/localization/message-context";
import type { ReactNode } from "react";
import { assetUrl } from "../shared/assets";
import { ArtCard } from "../shared/cards/art-card";
import { Screen } from "../shared/navigation/screen";
export function HomeScreen({ children }: { children: ReactNode }) {
  const i18n = useMessages();
  return (
    <Screen className="home-screen menu-layout">
      <h1 className="sr-only">Fauna</h1>
      <ArtCard
        presentation
        artwork={assetUrl("logo.main-menu")}
        aspect="creature"
        className="menu-logo"
        aria-label={i18n.message("menu.logo", "Fauna logo")}
      />
      <nav className="menu-choices" aria-label={i18n.message("menu.mainMenu", "Main menu")}>
        {children}
      </nav>
    </Screen>
  );
}
