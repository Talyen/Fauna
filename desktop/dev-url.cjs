function isDevelopmentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && !!url.port && url.origin === value;
  } catch {
    return false;
  }
}
module.exports = { isDevelopmentUrl };
