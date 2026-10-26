export type Operations = Pick<typeof import("./damage"), "bounce" | "hit" | "resolveHit" | "negateAttack"> &
  Pick<
    typeof import("./protection"),
    | "restoreHealth"
    | "shareProtection"
    | "grantBlock"
    | "gainMana"
    | "grantArmor"
    | "leechHealth"
    | "healthThresholds"
  > &
  Pick<
    typeof import("./statuses"),
    | "grantStatus"
    | "triggerArmorBreak"
    | "removeControlBuildup"
    | "removeEffects"
    | "returnCleansedEffect"
    | "cleanseRewards"
    | "cleanseThorns"
    | "poisonCleanseMana"
    | "applyHarmfulStatus"
    | "controlRewards"
    | "applyBlind"
  > &
  Pick<typeof import("./lifecycle"), "tickStatuses" | "startAction">;
export type OperationName = keyof Operations;
export type CombatArguments<K extends OperationName> = Parameters<Operations[K]>;
export type CombatResult<K extends OperationName> =
  ReturnType<Operations[K]> extends Generator<unknown, infer R, unknown> ? R : never;
export type CombatOperation = { [K in OperationName]: { kind: K; args: CombatArguments<K> } }[OperationName];
export type Resolution<R = void> = Generator<CombatOperation, R, unknown>;

/** Yield one child to the explicit stack, retaining typed results in the suspended parent. */
export function* reaction<K extends OperationName>(
  kind: K,
  ...args: CombatArguments<K>
): Resolution<CombatResult<K>> {
  return (yield { kind, args } as CombatOperation) as CombatResult<K>;
}
