import { useMessages } from "../shared/localization/message-context";
import { EffectButton as Button } from "../shared/effects/treatments";
import { Swords, House, Power, BookOpen, WandSparkles, Cog } from "lucide-react";

export type MenuPage = "talents" | "collection" | "settings";
interface MenuActionsProps {
  home: boolean;
  battle: boolean;
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
  battle,
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
      <BookOpen aria-hidden="true" className="menu-icon-collection" />
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
        {home
          ? active
            ? i18n.message("menu.continue", "Continue")
            : i18n.message("menu.play", "Play")
          : battle
            ? i18n.message("menu.returnToBattle", "Return to Battle")
            : i18n.message("menu.returnToRun", "Return to Run")}
      </Button>
      {!home ? (
        <Button variant="ghost" onClick={onHome}>
          <House aria-hidden="true" />
          {i18n.message("menu.mainMenuAction", "Main Menu")}
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
        <WandSparkles aria-hidden="true" className="menu-icon-talents" />
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
        <Cog aria-hidden="true" className="menu-icon-settings" />
        {i18n.message("menu.options", "Options")}
      </Button>
      {!home && active ? (
        <>
          <div className="pause-menu-separator" aria-hidden="true" />
          <Button variant="ghost" className="end-journey" onClick={onEndJourney}>
            <Swords aria-hidden="true" className="menu-icon-end" />
            {i18n.message("menu.endRun", "End Run")}
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
