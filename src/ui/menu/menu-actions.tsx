import { useMessages } from "../shared/localization/message-context";
import { EffectButton as Button } from "../shared/effects/treatments";
import {
  Swords,
  Sparkles,
  PawPrint,
  Settings2,
  LogOut,
  House,
  Power,
  BookOpen,
  WandSparkles,
  Cog,
} from "lucide-react";

export type MenuPage = "talents" | "collection" | "settings";
interface MenuActionsProps {
  home: boolean;
  active: boolean;
  talentPoints: number;
  closing: boolean;
  onContinue: () => void;
  onNavigate: (page: MenuPage) => void;
  onEndJourney: () => void;
  onHome: () => void;
  onQuit: () => void;
}
export function MenuActions({
  home,
  active,
  talentPoints,
  closing,
  onContinue,
  onNavigate,
  onEndJourney,
  onHome,
  onQuit,
}: MenuActionsProps) {
  const i18n = useMessages();
  const collection = (
    <Button
      effectTone="gold"
      variant={home ? "outline" : "ghost"}
      data-menu-action="collection"
      onClick={() => onNavigate("collection")}
    >
      {home ? (
        <BookOpen aria-hidden="true" className="menu-icon-collection" />
      ) : (
        <PawPrint aria-hidden="true" className="menu-icon-collection" />
      )}
      {i18n.message("menu.collection", "Collection")}
    </Button>
  );
  return (
    <>
      <Button
        effectTone="play"
        variant={home ? "default" : "ghost"}
        className="primary-menu-action"
        data-menu-action="continue"
        onClick={onContinue}
      >
        <Swords aria-hidden="true" />
        {home && !active ? i18n.message("menu.play", "Play") : i18n.message("menu.continue", "Continue")}
      </Button>
      {!home ? (
        <Button variant="ghost" onClick={onHome}>
          <House aria-hidden="true" className="menu-icon-home" />
          {i18n.message("menu.mainMenu", "Main menu")}
        </Button>
      ) : null}
      {collection}
      <Button
        variant={home ? "outline" : "ghost"}
        effectTone="talents"
        data-menu-action="talents"
        aria-label={i18n.message("menu.talents", "Talents")}
        aria-describedby={talentPoints > 0 ? `menu-talent-points-${home}` : undefined}
        onClick={() => onNavigate("talents")}
      >
        {home ? (
          <WandSparkles aria-hidden="true" className="menu-icon-talents" />
        ) : (
          <Sparkles aria-hidden="true" className="menu-icon-talents" />
        )}
        {i18n.message("menu.talents", "Talents")}
        {talentPoints > 0 ? (
          <span
            className={home ? "talent-category-notice" : "menu-talent-points"}
            id={`menu-talent-points-${home}`}
            aria-label={i18n.plural(
              "menu.talentPoints",
              { one: "{{count}} talent point available", other: "{{count}} talent points available" },
              talentPoints,
            )}
          >
            {home ? null : talentPoints}
          </span>
        ) : null}
      </Button>

      <Button
        effectTone="settings"
        variant={home ? "outline" : "ghost"}
        data-menu-action="settings"
        onClick={() => onNavigate("settings")}
      >
        {home ? (
          <Cog aria-hidden="true" className="menu-icon-settings" />
        ) : (
          <Settings2 aria-hidden="true" className="menu-icon-settings" />
        )}
        {home ? i18n.message("menu.options", "Options") : i18n.message("menu.settings", "Settings")}
      </Button>
      {!home && active ? (
        <>
          <div className="pause-menu-separator" aria-hidden="true" />
          <Button variant="ghost" className="end-journey" onClick={onEndJourney}>
            <LogOut aria-hidden="true" className="menu-icon-end" />
            {i18n.message("menu.endJourney", "End journey")}
          </Button>
        </>
      ) : null}
      {home ? (
        <Button className="menu-quit" variant="outline" busy={closing} onClick={onQuit}>
          <Power aria-hidden="true" className="menu-icon-quit" />
          {i18n.message("menu.quitShort", "Quit")}
        </Button>
      ) : null}
    </>
  );
}
