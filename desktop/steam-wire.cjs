/** @param {unknown} value @returns {import("./steam-types").SteamRequest} */
function parseRequest(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid Steam request.");
  const request = /** @type {Record<string, unknown>} */ (value);
  const { id, operation, args } = request;
  if (!Number.isSafeInteger(id) || Number(id) <= 0 || !Array.isArray(args))
    throw new Error("Invalid Steam request.");
  const valid =
    (operation === "init" && args.length === 1 && Number.isSafeInteger(args[0]) && args[0] > 0) ||
    ((operation === "enabled" || operation === "list") && args.length === 0) ||
    (operation === "read" && args.length === 1 && typeof args[0] === "string") ||
    (operation === "write" && args.length === 2 && args.every((arg) => typeof arg === "string"));
  if (!valid) throw new Error("Invalid Steam request.");
  return /** @type {import("./steam-types").SteamRequest} */ (value);
}
/**
 * Validate native results before resolving typed application capabilities.
 * @template {keyof import("./steam-types").SteamRequests} K
 * @param {K} operation
 * @param {unknown} value
 * @returns {import("./steam-types").SteamRequests[K]["result"]}
 */
function parseReply(operation, value) {
  const valid =
    (operation === "init" && typeof value === "string" && /^\d{1,20}$/.test(value)) ||
    ((operation === "enabled" || operation === "write") && typeof value === "boolean") ||
    (operation === "list" &&
      Array.isArray(value) &&
      value.length <= 64 &&
      value.every((name) => typeof name === "string")) ||
    (operation === "read" && (value === null || typeof value === "string"));
  if (!valid) throw new Error("Invalid Steam response.");
  return /** @type {import("./steam-types").SteamRequests[K]["result"]} */ (value);
}
module.exports = { parseRequest, parseReply };
