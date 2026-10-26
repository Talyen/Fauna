import { talentRule, type TalentRuleId } from "../rules/talents";

type Talent<Id extends string> = Id extends `${infer Keyword}.${infer Effect}`
  ? Readonly<{ id: Id; keyword: Keyword; effect: Effect; name: string; text: string; row: number }>
  : never;

export function talent<const Id extends TalentRuleId>(id: Id, name: string, row: number): Talent<Id> {
  const separator = id.indexOf(".");
  return {
    id,
    keyword: id.slice(0, separator),
    effect: id.slice(separator + 1),
    name,
    text: talentRule(id).text,
    row,
  } as Talent<Id>;
}
