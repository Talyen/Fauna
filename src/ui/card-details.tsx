import { CARDS, definition, species, type SpeciesId } from "../game/content";
import { actionValue } from "../game/rules";
import type { Creature, Card } from "../game/types";
import { CardRules } from "./combat-values";
export function ActionDetails({
  card,
  ownerName,
  actor,
}: {
  card: Card;
  ownerName: string;
  actor?: Creature;
}) {
  const def = definition(card.definitionId);
  return (
    <div className="card-details">
      <strong>
        {def.name}
        {card.level ? ` +${card.level}` : ""}
      </strong>
      <p>
        {ownerName} · {def.cost} energy
      </p>
      <CardRules
        card={def}
        level={card.level}
        value={actionValue(card, actor ?? { species: def.species, attacked: false })}
      />
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
  cards,
  actor,
}: {
  kind: SpeciesId;
  name?: string;
  health?: number;
  maxHealth?: number;
  block?: number;
  marks?: number;
  cards?: readonly Card[];
  actor?: Creature;
}) {
  const info = species(kind);
  return (
    <div className="card-details">
      <strong>{name ?? info.name}</strong>
      <p>
        {health ?? info.health}/{maxHealth ?? info.health} health{block ? ` · ${block} block` : ""}
        {marks ? ` · ${marks} marks` : ""}
      </p>
      {!name && (
        <>
          <p>{info.description}</p>
          {CARDS.filter((c) => c.species === kind).map((c) => {
            const level = cards?.find((card) => card.definitionId === c.id)?.level ?? 0;
            return (
              <div key={c.id}>
                <strong>
                  {c.name}
                  {level ? ` +${level}` : ""} · {c.cost} energy
                </strong>
                <CardRules
                  card={c}
                  level={level}
                  value={actionValue(
                    { id: c.id, definitionId: c.id, ownerId: kind, level },
                    actor ?? { species: kind, attacked: false },
                  )}
                />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
