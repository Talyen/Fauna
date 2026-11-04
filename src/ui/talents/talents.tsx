import { Confirmation } from "../shared/confirmation";
import { useMessages } from "../shared/localization/message-context";
import { EffectBaseline } from "../shared/effects/effects";
import { effectPalette } from "../shared/effects/palettes";
import { EffectButton as Button } from "../shared/effects/treatments";
import { Screen, ScreenHeading } from "../shared/navigation/screen";
import { motionValue } from "../shared/motion-values";
import { assetUrl } from "../shared/assets";
import { KeywordText } from "../shared/keyword-text";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
  RotateCcw,
} from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { ArtCard } from "../shared/cards/art-card";
import { returnFocus } from "../shared/navigation/focus";
import { KEYWORDS, keywordLabel, availablePoints, canBuyTalent, type Keyword } from "../../game/progression";
import { TALENTS } from "../../game/content";
import type { Command, GameState } from "../../game/types";
import type { Inspection } from "../shared/inspection-model";
import type { Controls } from "../shared/navigation/input";

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
const talentTrees = new Map(
  KEYWORDS.map((keyword) => {
    const talents = TALENTS.filter((talent) => talent.keyword === keyword);
    const rows = [...new Set(talents.map((talent) => talent.row))];
    return [keyword, { talents, rows }] as const;
  }),
);
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
  const i18n = useMessages();
  const keywordName = (id: Keyword) => i18n.content(`content.keyword.${id}.label`, keywordLabel(id));
  const [keyword, setKeyword] = useState<Keyword | null>(null);
  const [treeReset, setTreeReset] = useState(0);
  const [resetAll, setResetAll] = useState(false);
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
  const points = keyword ? availablePoints(game, keyword) : 0;
  const tree = keyword ? talentTrees.get(keyword)! : undefined;
  return (
    <Screen
      data-nav-layout="rows"
      className="talents-screen"
      data-view={keyword ? "tree" : "overview"}
      ref={screen}
    >
      <EffectBaseline palette={keyword ? effectPalette([keyword]) : null} />
      <header className="page-heading talents-heading">
        <ScreenHeading
          back={keyword ? () => setKeyword(null) : openMenu}
          openMenu={openMenu}
          trailing={
            <>
              {" "}
              <Button
                variant="ghost"
                size="icon"
                className="compact-icon-control"
                aria-label={i18n.message("talents.resetAll", "Reset all talents")}
                disabled={!game.talents.length}
                onClick={() => setResetAll(true)}
              >
                <RotateCcw aria-hidden="true" />
              </Button>
              {keyword ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="compact-icon-control"
                  aria-label={i18n.message("talents.reset", "Reset {{keyword}} talents", {
                    keyword: keywordName(keyword),
                  })}
                  disabled={!game.talents.some((id) => id.startsWith(`${keyword}.`))}
                  onClick={() => {
                    if (send({ type: "resetTalents", keyword })) setTreeReset((value) => value + 1);
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                </Button>
              ) : null}
            </>
          }
        >
          {keyword ? keywordName(keyword) : i18n.message("menu.talents", "Talents")}
        </ScreenHeading>
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
                    shine={false}
                    hoverShimmer
                    data-talent-keyword={id}
                    aria-label={i18n.message("talents.category", "{{keyword}} talents", {
                      keyword: keywordName(id),
                    })}
                    aria-describedby={points > 0 ? `${id}-available-points` : undefined}
                    onClick={() => setKeyword(id)}
                  />
                  <h2>
                    {keywordName(id)}
                    {points > 0 ? <span className="talent-category-notice" aria-hidden="true" /> : null}
                  </h2>
                  {points > 0 ? (
                    <span className="sr-only" id={`${id}-available-points`}>
                      {i18n.plural(
                        "talents.pointsAvailable",
                        { one: "{{count}} point available", other: "{{count}} points available" },
                        points,
                      )}
                    </span>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* A named scrolling region makes every tier reachable without pagination. */}
          {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The named region needs focus for keyboard and controller scrolling */}
          <div
            key={`${keyword}:${treeReset}`}
            className="secondary-scroll-region talent-tree-viewport"
            data-scroll-region
            role="region"
            aria-label={i18n.message("talents.category", "{{keyword}} talents", {
              keyword: keywordName(keyword),
            })}
            tabIndex={0}
            onFocusCapture={(event) => {
              if (event.target instanceof HTMLElement && event.target.matches(".talent-node"))
                event.target.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
            }}
          >
            <div className="talent-tree">
              {tree!.rows.map((row) => (
                <div
                  className="talent-row"
                  key={row}
                  data-nav-row
                  aria-label={i18n.message("talents.row", "Row {{row}}", { row: row + 1 })}
                >
                  {tree!.talents
                    .filter((t) => t.row === row)
                    .map((t) => {
                      const talentName = i18n.content(`content.talent.${t.id}.name`, t.name);
                      const categoryName = i18n.content(
                        `content.keyword.${keyword}.label`,
                        keywordLabel(keyword),
                      );
                      const TalentSymbol = talentSymbols[t.id]!;
                      const owned = game.talents.includes(t.id),
                        available = canBuyTalent(game, t.id);
                      const earlierRowsOwned = tree!.talents.every(
                        (talent) => talent.row >= t.row || game.talents.includes(talent.id),
                      );
                      const status = owned
                        ? i18n.message("talents.unlocked", "Unlocked")
                        : available
                          ? i18n.message("talents.unlockOne", "Unlock · 1 point")
                          : !earlierRowsOwned
                            ? points > 0
                              ? i18n.message("talents.requiresRows", "Requires all earlier rows")
                              : i18n.message(
                                  "talents.requiresPointAndRows",
                                  "Requires 1 point and all earlier rows",
                                )
                            : i18n.message("talents.requiresPoint", "Requires 1 point");
                      return (
                        <Tooltip key={t.id}>
                          <TooltipTrigger asChild>
                            <Button
                              effectKeywords={[keyword]}
                              variant="outline"
                              className="talent-node"
                              aria-label={
                                owned
                                  ? i18n.message("talents.unlockedName", "{{name}}, unlocked", {
                                      name: talentName,
                                    })
                                  : talentName
                              }
                              aria-disabled={!available}
                              aria-describedby={`${t.id}-effect ${t.id}-status`}
                              data-owned={owned}
                              style={{ "--talent-accent": `var(--keyword-${keyword})` } as CSSProperties}
                              data-purchased={purchased === t.id || undefined}
                              data-available={available}
                              onClick={() => {
                                if (available && send({ type: "buyTalent", talentId: t.id }))
                                  setPurchased(t.id);
                              }}
                            >
                              <span className="talent-card-heading">
                                <span data-keyword={keyword}>
                                  <TalentSymbol className="talent-icon" aria-hidden="true" />
                                </span>
                                <span className="talent-name">{talentName}</span>
                              </span>
                              <span className="talent-effect" id={`${t.id}-effect`}>
                                <KeywordText
                                  text={t.text}
                                  id={`content.talent.${t.id}.rule`}
                                  keywordColorVariables
                                />
                              </span>
                              <span className="sr-only" id={`${t.id}-status`}>
                                {status}
                              </span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <strong>
                              {i18n.message("talents.detailTitle", "{{keyword}} · {{name}}", {
                                keyword: categoryName,
                                name: talentName,
                              })}
                            </strong>
                            <p>
                              <KeywordText text={t.text} id={`content.talent.${t.id}.rule`} />
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
          {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
          <div className="talent-points" aria-live="polite" aria-atomic="true">
            {points > 0
              ? i18n.plural(
                  "talents.pointsAvailable",
                  { one: "{{count}} point available", other: "{{count}} points available" },
                  points,
                )
              : null}
          </div>
        </>
      )}
      <Confirmation
        open={resetAll}
        title={i18n.message("talents.resetAll", "Reset all talents")}
        description={i18n.message("talents.resetAllDescription", "This will refund all your talent points")}
        confirmLabel={i18n.message("talents.resetAll", "Reset all talents")}
        onClose={() => setResetAll(false)}
        onConfirm={() => {
          if (send({ type: "resetTalents" })) {
            setResetAll(false);
            setTreeReset((value) => value + 1);
          }
        }}
      />
    </Screen>
  );
}
