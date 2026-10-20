import { CombatStatus } from "./combat-status";
import { KeywordText } from "./keyword-text";
import { definition, enemyCard, species, type SpeciesId } from "../game/content";
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
  enemy = false,
  enemyValue,
}: {
  card: Card;
  enemy?: boolean;
  enemyValue?: number;
  ownerName: string;
  actor?: Creature;
  modifiers?: GameState;
}) {
  const def = enemy ? enemyCard(definition(card.definitionId)) : definition(card.definitionId);
  return (
    <div className="card-details">
      <strong>
        {def.name}
        {card.level ? ` +${card.level}` : ""}
      </strong>
      <p>
        <KeywordText text={enemy ? ownerName : `${ownerName} · ${def.cost} mana`} />
      </p>
      <CardRules
        card={def}
        level={card.level}
        value={
          enemyValue ??
          actionValue(card, actor ?? { species: def.species, attacked: false }, modifiers) +
            (def.effect === "attack" && (def.damageType === "physical" || def.damageType === "stun")
              ? (actor?.combat?.forge ?? 0)
              : 0)
        }
      />
      {!enemy ? <Followups card={card} modifiers={modifiers} /> : null}
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
  combat,
}: {
  kind: SpeciesId;
  name?: string;
  health?: number;
  maxHealth?: number;
  block?: number;
  speciesKit?: boolean;
  combat?: import("../game/types").CombatState;
}) {
  const info = species(kind);
  return (
    <div className="card-details">
      <strong>{name ?? info.name}</strong>
      <p>
        {health ?? info.health}/{maxHealth ?? info.health} health{block ? ` · ${block} block` : ""}
      </p>
      <CombatStatus combat={combat} />
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
