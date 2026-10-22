import { creaturePassive } from "../../../game/progression";
import { CombatStatus } from "../combat/combat-status";
import { KeywordText } from "../keyword-text";
import { CARDS, definition, species, type SpeciesId } from "../../../game/content";
import { enemyCard } from "../../../game/card-rules";
import { definitionKeywords, keywordLabel } from "../../../game/keywords";
import { actionValue, cardCost, physicalBonus } from "../../../game/ability-rules";
import type { Creature, Card, GameState } from "../../../game/types";
import { CardRules } from "../combat/combat-values";
export function StarterDetails({ game, kind }: { game: GameState; kind: SpeciesId }) {
  const creature = species(kind);
  const actions = CARDS.filter((card) => card.species === kind);
  const keywords = [...new Set(actions.flatMap(definitionKeywords))];
  return (
    <div className="card-details starter-details">
      <strong>{creature.name}</strong>
      <p>
        <KeywordText text={keywords.map(keywordLabel).join(" · ")} />
      </p>
      <p>
        <strong>{creature.trait}</strong> · <KeywordText text={creaturePassive(game, kind).description} />
      </p>
      <div className="starter-kit">
        {actions.map((action) => (
          <p key={action.id}>
            <strong>{action.name}</strong> · {cardCost({ definitionId: action.id }, game)} Mana
          </p>
        ))}
      </div>
    </div>
  );
}
export function ActionDetails({
  card,
  ownerName,
  actor,
  modifiers,
  enemy = false,
  enemyValue,
  enemyPower = 1,
  compact = false,
}: {
  card: Card;
  compact?: boolean;
  enemy?: boolean;
  enemyValue?: number;
  enemyPower?: number;
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
      {compact ? null : (
        <p>
          <KeywordText
            text={
              enemy ? ownerName : `${ownerName} · ${modifiers ? cardCost(card, modifiers) : def.cost} mana`
            }
          />
        </p>
      )}
      {card.temporary && !def.consume ? <p>Copy · Lasts for this battle</p> : null}
      <CardRules
        card={def}
        power={enemyPower}
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
  block = 0,
  speciesKit = false,
  sharedDodge = 0,
  combat,
}: {
  kind: SpeciesId;
  progression?: Pick<GameState, "discovery">;
  name?: string;
  block?: number;
  speciesKit?: boolean;
  combat?: import("../../../game/types").CombatState;
  sharedDodge?: number;
}) {
  const info = species(kind);
  return (
    <div className="card-details">
      <strong>
        {name ?? info.name}
        {info.legendary ? " · Legendary" : ""}
      </strong>
      {block ? <p>{block} block</p> : null}
      <CombatStatus combat={combat} sharedDodge={sharedDodge} details />
      {!name || speciesKit || info.legendary ? (
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
