import { EffectBaseline } from "../shared/effects/effects";
import { effectPalette } from "../shared/effects/palettes";
import { EffectButton as Button, ShineText } from "../shared/effects/treatments";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { PagedItems } from "../shared/navigation/pagination";
import { motionValue } from "../shared/motion-values";
import { assetUrl } from "../shared/assets";
import { KeywordText } from "../shared/keyword-text";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Swords,
  ShieldPlus,
  Flame,
  Anvil,
  Snowflake,
  ShieldHalf,
  Zap,
  ShieldOff,
  FlaskConical,
  Hourglass,
  Leaf,
  Sprout,
  Sun,
  HeartHandshake,
  Droplets,
  Skull,
  Shield,
  ShieldCheck,
  HeartPlus,
  HeartPulse,
  Shell,
  BrickWall,
  Wind,
  Footprints,
  Heart,
  Link,
  Gem,
  Battery,
} from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { ArtCard } from "../shared/cards/art-card";
import { returnFocus } from "../shared/navigation/focus";
import {
  KEYWORDS,
  keywordLabel,
  keywordProgress,
  availablePoints,
  canBuyTalent,
  type Keyword,
} from "../../game/progression";
import { TALENTS } from "../../game/content";
import type { Command, GameState } from "../../game/types";
import type { Inspection } from "../shared/inspection-model";
import type { Controls } from "../shared/navigation/input";
import { Progress } from "../shared/progress";

const originalTalentSymbols = {
  physical: [Swords, ShieldPlus],
  burn: [Flame, Anvil],
  freeze: [Snowflake, ShieldHalf],
  stun: [Zap, ShieldOff],
  poison: [FlaskConical, Hourglass],
  nature: [Leaf, Sprout],
  water: [Droplets, Shield],
  light: [Sun, HeartHandshake],
  bleed: [Droplets, Skull],
  block: [Shield, ShieldCheck],
  health: [HeartPlus, HeartPulse],
  armor: [Shell, BrickWall],
  dodge: [Wind, Footprints],
  leech: [Heart, Link],
  mana: [Gem, Battery],
};
const talentSymbols = Object.fromEntries(
  KEYWORDS.flatMap((keyword) => {
    const talents = TALENTS.filter((talent) => talent.keyword === keyword);
    const original = originalTalentSymbols[keyword];
    const symbols = [
      ...original,
      ...Object.values(originalTalentSymbols)
        .flat()
        .filter((symbol) => !original.includes(symbol)),
    ];
    return talents.map((talent, index) => [talent.id, symbols[index]!] as const);
  }),
);
type Props = { game: GameState; send: (command: Command) => boolean; inspect: (item: Inspection) => void };
export function Talents({
  game,
  send,
  openMenu,
  controls: controlsRef,
}: {
  game: GameState;
  send: Props["send"];
  openMenu: () => void;
  controls?: Controls;
}) {
  const [keyword, setKeyword] = useState<Keyword | null>(null);
  const [treeReset, setTreeReset] = useState(0);
  const [purchased, setPurchased] = useState<string | null>(null);
  const lastKeyword = useRef<Keyword | null>(null);
  const screen = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!purchased) return;
    const timer = setTimeout(() => setPurchased(null), motionValue("--motion-battle"));
    return () => clearTimeout(timer);
  }, [purchased]);
  useLayoutEffect(() => {
    if (keyword) {
      lastKeyword.current = keyword;
      returnFocus(screen.current?.querySelector<HTMLElement>(".talent-node") ?? null);
    } else if (lastKeyword.current)
      returnFocus(
        screen.current?.querySelector<HTMLElement>(`[data-talent-keyword="${lastKeyword.current}"]`) ?? null,
      );
    if (controlsRef)
      controlsRef.current = (action) => {
        if (action === "back" && keyword) {
          setKeyword(null);
          return true;
        }
        return false;
      };
    return () => {
      if (controlsRef) controlsRef.current = null;
    };
  }, [keyword, controlsRef, treeReset]);
  const p = keywordProgress(keyword ? (game.keywordXP[keyword] ?? 0) : 0);
  const artwork: Record<Keyword, string> = {
    physical: "physical",
    burn: "fire",
    freeze: "ice",
    stun: "lightning",
    poison: "poison",
    nature: "nature",
    water: "water",
    light: "light",
    bleed: "bleed",
    block: "block",
    health: "heal",
    armor: "armor",
    dodge: "dodge",
    leech: "leech",
    mana: "mana",
  };
  return (
    <Screen className="talents-screen" data-view={keyword ? "tree" : "overview"} ref={screen}>
      <EffectBaseline palette={keyword ? effectPalette([keyword]) : null} />
      <header className="page-heading talents-heading">
        <ScreenHeading back={keyword ? () => setKeyword(null) : openMenu} openMenu={openMenu}>
          {keyword ? <ShineText keywords={[keyword]}>{keywordLabel(keyword)}</ShineText> : "Talents"}
        </ScreenHeading>
        {keyword ? (
          <Button
            variant="ghost"
            disabled={!game.talents.some((id) => id.startsWith(`${keyword}.`))}
            onClick={() => {
              if (send({ type: "resetTalents", keyword })) setTreeReset((value) => value + 1);
            }}
          >
            Reset {keywordLabel(keyword)} talents
          </Button>
        ) : null}
      </header>
      {keyword === null ? (
        <div className="talent-overview-viewport">
          <div className="talent-overview">
            {KEYWORDS.map((id) => {
              const points = availablePoints(game, id);
              return (
                <section className="talent-category" key={id}>
                  <ArtCard
                    aspect="action"
                    artwork={assetUrl(`keyword.${artwork[id]}`)}
                    effectKeywords={[id]}
                    data-talent-keyword={id}
                    aria-label={`${keywordLabel(id)} talents`}
                    aria-describedby={points > 0 ? `${id}-available-points` : undefined}
                    onClick={() => setKeyword(id)}
                  />
                  <h2>
                    <ShineText keywords={[id]}>{keywordLabel(id)}</ShineText>
                  </h2>
                  <p className="talent-category-points" id={`${id}-available-points`}>
                    {points > 0 ? `${points} ${points === 1 ? "point" : "points"} available` : null}
                  </p>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="talent-progress-group">
            <div className="talent-progress">
              <span aria-live="polite" aria-atomic="true">
                {availablePoints(game, keyword)} {availablePoints(game, keyword) === 1 ? "point" : "points"}{" "}
                available
              </span>
              <span>
                {p.current} / {p.required} XP
              </span>
            </div>
            <Progress
              value={p.current}
              maximum={p.required}
              label={`${keywordLabel(keyword)} XP`}
              tone={keyword}
            />
          </div>
          <PagedItems
            key={`${keyword}:${treeReset}`}
            className="talent-tree"
            label="Talent pages"
            pageSize={1}
            adaptive={{ columns: 1, rows: 3 }}
            items={[
              ...new Set(TALENTS.filter((talent) => talent.keyword === keyword).map((talent) => talent.row)),
            ]}
          >
            {(row) => (
              <div className="talent-row" key={row} data-nav-row aria-label={`Row ${row + 1}`}>
                {TALENTS.filter((t) => t.keyword === keyword && t.row === row).map((t) => {
                  const TalentSymbol = talentSymbols[t.id]!;
                  const owned = game.talents.includes(t.id),
                    available = canBuyTalent(game, t.id);
                  const earlierRowsOwned = TALENTS.filter(
                    (talent) => talent.keyword === keyword && talent.row < t.row,
                  ).every((talent) => game.talents.includes(talent.id));
                  const status = owned
                    ? "Unlocked"
                    : available
                      ? "Unlock · 1 point"
                      : !earlierRowsOwned
                        ? availablePoints(game, keyword) > 0
                          ? "Requires all earlier rows"
                          : "Requires 1 point and all earlier rows"
                        : "Requires 1 point";
                  return (
                    <Tooltip key={t.id}>
                      <TooltipTrigger asChild>
                        <Button
                          effectKeywords={[keyword]}
                          variant="outline"
                          className="talent-node"
                          aria-label={`${t.name}${owned ? ", unlocked" : ""}`}
                          aria-disabled={!available}
                          aria-describedby={`${t.id}-effect ${t.id}-status`}
                          data-owned={owned}
                          data-keyword={keyword}
                          data-purchased={purchased === t.id || undefined}
                          data-available={available}
                          onClick={() => {
                            if (available && send({ type: "buyTalent", talentId: t.id })) setPurchased(t.id);
                          }}
                        >
                          <span className="talent-card-heading">
                            <span data-keyword={keyword}>
                              <TalentSymbol className="talent-icon" aria-hidden="true" />
                            </span>
                            <span className="talent-name">
                              <ShineText keywords={[keyword]}>{t.name}</ShineText>
                            </span>
                          </span>
                          <span className="talent-effect" id={`${t.id}-effect`}>
                            <KeywordText text={t.text} />
                          </span>
                          <span className="talent-status" id={`${t.id}-status`}>
                            {status}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <strong>
                          {keywordLabel(keyword)} · {t.name}
                        </strong>
                        <p>
                          <KeywordText text={t.text} />
                        </p>
                        <p>{status}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </PagedItems>
        </>
      )}
    </Screen>
  );
}
