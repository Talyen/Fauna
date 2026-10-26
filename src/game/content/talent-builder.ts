import type { ProgressionKeyword } from "../keywords";
import { talentRule } from "../rules/talents";

type ParameterId = Parameters<typeof talentRule>[0];
type Talent<Id extends string> = Id extends `${infer Keyword}.${infer Effect}`
  ? Readonly<{ id: Id; keyword: Keyword; effect: Effect; name: string; text: string; row: number }>
  : never;

export function talent<const Id extends ParameterId>(
  id: Id,
  name: string,
  row: number,
  describe: (rule: ReturnType<typeof talentRule<Id>>) => string,
): Talent<Id>;
export function talent<const Id extends `${ProgressionKeyword}.${string}`>(
  id: Id,
  name: string,
  row: number,
  text: string,
): Talent<Id>;
export function talent(
  id: `${ProgressionKeyword}.${string}`,
  name: string,
  row: number,
  text: string | ((rule: never) => string),
) {
  const separator = id.indexOf(".");
  return {
    id,
    keyword: id.slice(0, separator),
    effect: id.slice(separator + 1),
    name,
    text: typeof text === "string" ? text : text(talentRule(id as ParameterId) as never),
    row,
  };
}
