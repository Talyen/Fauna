import { Swords, Users, Sparkles, PawPrint, Gift, BookOpen, Settings2, LogOut, House } from "lucide-react";
import { Button } from "../../components/ui/button";
export type MenuPage = "talents" | "collection" | "settings" | "glossary";
interface MenuActionsProps {
  home: boolean;
  active: boolean;
  canManageLineup: boolean;
  hasBoons: boolean;
  talentPoints: number;
  desktop: boolean;
  closing: boolean;
  onContinue: () => void;
  onLineup: () => void;
  onBoons: () => void;
  onNavigate: (page: MenuPage) => void;
  onEndJourney: () => void;
  onHome: () => void;
  onQuit: () => void;
}
export function MenuActions({
  home,
  active,
  canManageLineup,
  hasBoons,
  talentPoints,
  desktop,
  closing,
  onContinue,
  onLineup,
  onBoons,
  onNavigate,
  onEndJourney,
  onHome,
  onQuit,
}: MenuActionsProps) {
  return (
    <>
      <Button variant={home ? "default" : "ghost"} className="primary-menu-action" onClick={onContinue}>
        <Swords aria-hidden="true" />
        {home && !active ? "Play" : "Continue"}
      </Button>
      {canManageLineup ? (
        <Button variant="ghost" onClick={onLineup}>
          <Users aria-hidden="true" className="menu-icon-lineup" />
          Lineup
        </Button>
      ) : null}
      <Button
        variant="ghost"
        aria-label="Talents"
        aria-describedby={talentPoints > 0 ? `menu-talent-points-${home}` : undefined}
        onClick={() => onNavigate("talents")}
      >
        <Sparkles aria-hidden="true" className="menu-icon-talents" />
        Talents
        {talentPoints > 0 ? (
          <span
            className="menu-talent-points"
            id={`menu-talent-points-${home}`}
            aria-label={`${talentPoints} talent ${talentPoints === 1 ? "point" : "points"} available`}
          >
            {talentPoints}
          </span>
        ) : null}
      </Button>
      <Button variant="ghost" onClick={() => onNavigate("collection")}>
        <PawPrint aria-hidden="true" className="menu-icon-collection" />
        Collection
      </Button>
      {active && hasBoons ? (
        <Button variant="ghost" onClick={onBoons}>
          <Gift aria-hidden="true" className="menu-icon-boons" />
          Boons
        </Button>
      ) : null}
      <Button variant="ghost" onClick={() => onNavigate("glossary")}>
        <BookOpen aria-hidden="true" className="menu-icon-glossary" />
        Glossary
      </Button>
      <Button variant="ghost" onClick={() => onNavigate("settings")}>
        <Settings2 aria-hidden="true" className="menu-icon-settings" />
        Settings
      </Button>
      {!home && active ? (
        <Button variant="ghost" className="end-journey" onClick={onEndJourney}>
          <LogOut aria-hidden="true" className="menu-icon-end" />
          End journey
        </Button>
      ) : null}
      {!home ? (
        <Button variant="ghost" onClick={onHome}>
          <House aria-hidden="true" className="menu-icon-home" />
          Main menu
        </Button>
      ) : null}
      {desktop ? (
        <Button variant="ghost" busy={closing} onClick={onQuit}>
          <LogOut aria-hidden="true" className="menu-icon-quit" />
          Save & quit
        </Button>
      ) : null}
    </>
  );
}
