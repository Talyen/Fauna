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
          Acting creature gains <span data-combat-tone="block">{block} Block</span>.
        </p>
      ) : null}
      {heal > 0 ? (
        <p>
          Acting creature restores <span data-combat-tone="health">{heal} Health</span>.
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
        {ownerName} · {def.cost} mana
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
  marks = 0,
}: {
  kind: SpeciesId;
  name?: string;
  health?: number;
  maxHealth?: number;
  block?: number;
  marks?: number;
}) {
  const info = species(kind);
  return (
    <div className="card-details">
      <strong>{name ?? info.name}</strong>
      <p>
        {health ?? info.health}/{maxHealth ?? info.health} health{block ? ` · ${block} block` : ""}
        {marks ? ` · ${marks} marks` : ""}
      </p>
      {!name ? <p>{info.description}</p> : null}
    </div>
  );
}
