import { KeywordText } from "./keyword-text";
import { definition, species, type SpeciesId } from "../game/content";
import { actionValue, cardFollowups } from "../game/rules";
import type { Creature, Card, GameState } from "../game/types";
import { CardRules } from "./combat-values";
function Followups({ card, modifiers }: { card: Pick<Card, "definitionId">; modifiers?: GameState }) {
  if (!modifiers) return null;
  const { block, heal } = cardFollowups(card, modifiers);
  return (
    <>
      {block > 0 ? (
        <p>
          <KeywordText text={`Acting creature gains ${block} Block.`} />
        </p>
      ) : null}
      {heal > 0 ? (
        <p>
          <KeywordText text={`Acting creature restores ${heal} Health.`} />
        </p>
      ) : null}
    </>
  );
}
export function ActionDetails({
  card,
  ownerName,
  actor,
  modifiers,
}: {
  card: Card;
  ownerName: string;
  actor?: Creature;
  modifiers?: GameState;
}) {
  const def = definition(card.definitionId);
  return (
    <div className="card-details">
      <strong>
        {def.name}
        {card.level ? ` +${card.level}` : ""}
      </strong>
      <p>
        <KeywordText text={`${ownerName} · ${def.cost} mana`} />
      </p>
      <CardRules
        card={def}
        level={card.level}
        value={actionValue(card, actor ?? { species: def.species, attacked: false }, modifiers)}
      />
      <Followups card={card} modifiers={modifiers} />
    </div>
  );
}
export function CreatureDetails({
  kind,
  name,
  health,
  maxHealth,
  block = 0,
  speciesKit = false,
}: {
  kind: SpeciesId;
  name?: string;
  health?: number;
  maxHealth?: number;
  block?: number;
  speciesKit?: boolean;
}) {
  const info = species(kind);
  return (
    <div className="card-details">
      <strong>{name ?? info.name}</strong>
      <p>
        {health ?? info.health}/{maxHealth ?? info.health} health{block ? ` · ${block} block` : ""}
      </p>
      {!name || speciesKit ? (
        <>
          {name && speciesKit ? <strong>Species kit · {info.name}</strong> : null}
          {speciesKit ? <strong>{info.trait}</strong> : null}
          <p>
            <KeywordText text={info.description} />
          </p>
        </>
      ) : null}
    </div>
  );
}
