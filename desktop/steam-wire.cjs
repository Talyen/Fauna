const CLOUD_MAX_BYTES = 1_048_576;
/** @param {unknown} name */
const validCloudSlot = (name) => typeof name === "string" && /^fauna-v1-[a-f0-9]{32}-[01]\.json$/.test(name);
/** @param {unknown} id */
const validAppId = (id) => Number.isSafeInteger(id) && Number(id) > 0 && Number(id) <= 0xffffffff;
/** @param {unknown} data */
const validCloudData = (data) => typeof data === "string" && Buffer.byteLength(data) <= CLOUD_MAX_BYTES;

/** @param {unknown} value @returns {import("./steam-types").SteamRequest} */
function parseRequest(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid Steam request.");
  const request = /** @type {Record<string, unknown>} */ (value);
  const { id, operation, args } = request;
  if (!Number.isSafeInteger(id) || Number(id) <= 0 || !Array.isArray(args))
    throw new Error("Invalid Steam request.");
  const valid =
    (operation === "init" && args.length === 1 && validAppId(args[0])) ||
    ((operation === "enabled" || operation === "language" || operation === "list") && args.length === 0) ||
    (operation === "read" && args.length === 1 && validCloudSlot(args[0])) ||
    (operation === "write" && args.length === 2 && validCloudSlot(args[0]) && validCloudData(args[1]));
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
    (operation === "enabled" && typeof value === "boolean") ||
    (operation === "language" &&
      (value === null || (typeof value === "string" && /^[a-z0-9_-]{1,32}$/i.test(value)))) ||
    (operation === "write" && value === true) ||
    (operation === "list" &&
      Array.isArray(value) &&
      value.length <= 64 &&
      value.every(validCloudSlot) &&
      new Set(value).size === value.length) ||
    (operation === "read" && (value === null || validCloudData(value)));
  if (!valid) throw new Error("Invalid Steam response.");
  return /** @type {import("./steam-types").SteamRequests[K]["result"]} */ (value);
}
/** @param {unknown} value @returns {{id: number, value?: unknown, error?: string}} */
function parseResponse(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid Steam response envelope.");
  const response = /** @type {Record<string, unknown>} */ (value);
  if (
    !Number.isSafeInteger(response.id) ||
    Number(response.id) <= 0 ||
    (response.error !== undefined && typeof response.error !== "string")
  )
    throw new Error("Invalid Steam response envelope.");
  return /** @type {{id: number, value?: unknown, error?: string}} */ (value);
}
module.exports = {
  CLOUD_MAX_BYTES,
  validCloudSlot,
  validCloudData,
  validAppId,
  parseRequest,
  parseReply,
  parseResponse,
};
