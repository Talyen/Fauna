import { creaturePassive } from "../game/progression";
import { CombatStatus } from "./combat-status";
import { KeywordText } from "./keyword-text";
import { definition, enemyCard, species, type SpeciesId } from "../game/content";
import { actionValue, cardCost, physicalBonus } from "../game/rules";
import type { Creature, Card, GameState } from "../game/types";
import { CardRules } from "./combat-values";
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
        <KeywordText
          text={enemy ? ownerName : `${ownerName} · ${modifiers ? cardCost(card, modifiers) : def.cost} mana`}
        />
      </p>
      <CardRules
        card={def}
        level={card.level}
        value={
          enemyValue ??
          Math.round(
            actionValue(card, actor ?? { species: def.species, attacked: false }, modifiers) +
              (modifiers && actor && def.effect === "attack" && def.damageType === "physical"
                ? physicalBonus(actor, modifiers)
                : 0),
          )
        }
      />
    </div>
  );
}
export function CreatureDetails({
  progression,
  kind,
  name,
  health,
  maxHealth,
  block = 0,
  speciesKit = false,
  combat,
}: {
  kind: SpeciesId;
  progression?: Pick<GameState, "discovery">;
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
      <CombatStatus combat={combat} details />
      {!name || speciesKit ? (
        <>
          {name && speciesKit ? <strong>Species kit · {info.name}</strong> : null}
          {speciesKit ? <strong>{info.trait}</strong> : null}
          <p>
            <KeywordText text={creaturePassive(progression, kind).description} />
          </p>
        </>
      ) : null}
    </div>
  );
}
