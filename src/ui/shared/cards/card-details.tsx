import { Sparkles } from "lucide-react";
import { ShineIcon, ShineText } from "../effects/treatments";
import { visualKeywords } from "../effects/palettes";
import { creaturePassive } from "../../../game/progression";
import { KeywordText } from "../keyword-text";
import { definition, species, type SpeciesId } from "../../../game/content";
import { enemyCard } from "../../../game/card-rules";
import { actionValue, cardCost, physicalBonus } from "../../../game/ability-rules";
import type { Creature, Card, GameState } from "../../../game/types";
import { CardRules } from "../combat/combat-values";
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
        modifiers={modifiers}
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
}: {
  kind: SpeciesId;
  progression?: Pick<GameState, "discovery">;
  name?: string;
}) {
  const info = species(kind);
  const passive = creaturePassive(progression, kind);
  const keywords = visualKeywords(passive.description);
  return (
    <div className="card-details">
      <strong>{name ?? info.name}</strong>
      <div className="creature-trait-name">
        <ShineIcon keywords={keywords}>
          <Sparkles />
        </ShineIcon>
        <strong>
          <ShineText keywords={keywords}>{info.trait}</ShineText>
        </strong>
      </div>
      <p>
        <KeywordText text={passive.description} />
      </p>
    </div>
  );
}
