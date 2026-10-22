const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const ENTRY = "fauna://app/index.html";
/** @param {string} url @param {string} root */
function resourcePath(url, root) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "fauna:" ||
    parsed.host !== "app" ||
    parsed.username ||
    parsed.password ||
    parsed.search
  )
    throw new Error("Untrusted application resource.");
  const decoded = decodeURIComponent(parsed.pathname);
  if (decoded.includes("\\") || decoded.includes("\0") || decoded.split("/").includes(".."))
    throw new Error("Invalid application resource.");
  const file = path.resolve(root, `.${decoded}`);
  if (!file.startsWith(path.resolve(root) + path.sep))
    throw new Error("Application resource escapes its root.");
  return file;
}
/** @param {string} root @param {(url: string) => Promise<Response>} fetchFile */
function createResourceHandler(root, fetchFile) {
  return async (/** @type {Request} */ request) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
      const file = await fs.realpath(resourcePath(request.url, root));
      const directory = await fs.realpath(root);
      if (!file.startsWith(directory + path.sep) || !(await fs.stat(file)).isFile())
        return new Response(null, { status: 404 });
      const response = await fetchFile(pathToFileURL(file).href);
      return request.method === "HEAD"
        ? new Response(null, { status: response.status, headers: response.headers })
        : response;
    } catch {
      return new Response(null, { status: 404 });
    }
  };
}
module.exports = { ENTRY, createResourceHandler };
