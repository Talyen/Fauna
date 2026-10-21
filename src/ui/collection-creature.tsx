import { useLayoutEffect, useRef } from "react";
import { CARDS, species, type SpeciesId } from "../game/content";
import { creaturePassive, creatureStars } from "../game/progression";
import type { GameState } from "../game/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ArtCard } from "./art-card";
import { assetUrl } from "./assets";
import { CardRules } from "./combat-values";
import { KeywordText } from "./keyword-text";
import { PagedItems } from "./pagination";
import { Screen, ScreenHeading } from "./screen";

/** Collection describes the species kit, independent of journey cards and battle modifiers. */
export function CollectionCreature({
  game,
  kind,
  back,
  openMenu,
}: {
  game: GameState;
  kind: SpeciesId;
  back: () => void;
  openMenu: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const creature = species(kind);
  const rank = creatureStars(game, kind);
  const passive = creaturePassive(game, kind);
  useLayoutEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('button[aria-label="Back"]')?.focus();
  }, []);
  return (
    <Screen className="collection-creature-screen" ref={root}>
      <ScreenHeading back={back} openMenu={openMenu}>
        {creature.name}
      </ScreenHeading>
      <div className="collection-creature-layout">
        <section className="collection-creature-trait" aria-label="Trait">
          <ArtCard
            aspect="creature"
            artwork={assetUrl(`creature.${kind}`)}
            presentation
            aria-label={creature.name}
          />
          <p className="collection-creature-rank">Collection rank: {rank} / 5 stars</p>
          <div className="collection-creature-passive">
            <h2>{creature.trait}</h2>
            <p>
              <KeywordText text={passive.description} />
            </p>
          </div>
        </section>
        <Tabs defaultValue="abilities" className="collection-creature-tabs">
          <TabsList aria-label="Creature details">
            <TabsTrigger value="abilities">Base abilities</TabsTrigger>
            <TabsTrigger value="ranks">Rank progression</TabsTrigger>
          </TabsList>
          <TabsContent value="abilities" className="collection-kit-content">
            <div className="collection-ability-grid" aria-label="Base abilities">
              {CARDS.filter((card) => card.species === kind).map((card) => (
                <section
                  className="collection-ability"
                  key={card.id}
                  aria-labelledby={`collection-${card.id}`}
                >
                  <ArtCard
                    aspect="action"
                    artwork={assetUrl(card.artwork ?? `action.${kind}`)}
                    presentation
                    aria-label={`${card.name} artwork`}
                  />
                  <div className="collection-ability-copy">
                    <div>
                      <h2 id={`collection-${card.id}`}>{card.name}</h2>
                      <p className="collection-ability-cost">{card.cost} Mana</p>
                    </div>
                    <CardRules card={card} />
                  </div>
                </section>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="ranks" className="collection-kit-content">
            <section className="passive-tiers" aria-label={`${creature.trait} passive tiers`}>
              <h2>Rank progression</h2>
              <PagedItems
                items={creature.passiveTiers}
                pageSize={1}
                className="passive-tier-page"
                contentRole="list"
                label="Passive tier pages"
              >
                {(tier, tierRank) => (
                  <div role="listitem" key={tierRank} aria-current={tierRank === rank ? "step" : undefined}>
                    <strong>
                      {tierRank} {tierRank === 1 ? "star" : "stars"}
                      {tierRank === rank ? " · Current rank" : ""}
                      {tierRank === passive.rank ? " · Active effect" : ""}
                    </strong>
                    <p>
                      <KeywordText text={tier.description} />
                    </p>
                  </div>
                )}
              </PagedItems>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </Screen>
  );
}
