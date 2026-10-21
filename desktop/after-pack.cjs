const path = require("node:path");
const fs = require("node:fs/promises");
const { flipFuses, getCurrentFuseWire, FuseVersion, FuseV1Options } = require("@electron/fuses");
const FUSES = Object.freeze({
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
  // Fauna's trusted file: renderer loads modules, fonts and media from local files.
  // Disable this only alongside a verified replacement application protocol.
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
  [FuseV1Options.WasmTrapHandlers]: true,
});
async function installSnapshots(directory) {
  for (const name of await fs.readdir(directory, { recursive: true })) {
    if (/^v8_context_snapshot.*\.bin$/.test(path.basename(name))) {
      const target = path.join(directory, path.dirname(name), "browser_v8_context_snapshot.bin");
      await fs.copyFile(path.join(directory, name), target);
    }
  }
}
module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName;
  const name = context.packager.appInfo.productFilename;
  const executable = path.join(
    context.appOutDir,
    platform === "darwin" ? `${name}.app` : `${name}${platform === "win32" ? ".exe" : ""}`,
  );
  await installSnapshots(context.appOutDir);
  const wire = await getCurrentFuseWire(executable);
  // Electron 39 has no WasmTrapHandlers slot; mandatory fuses remain explicit and strict.
  const supported = Object.fromEntries(
    Object.entries(FUSES).filter(
      ([index]) => Number(index) !== FuseV1Options.WasmTrapHandlers || Object.hasOwn(wire, index),
    ),
  );
  await flipFuses(executable, {
    version: FuseVersion.V1,
    ...supported,
    strictlyRequireAllFuses: true,
    resetAdHocDarwinSignature: platform === "darwin",
  });
};
module.exports.FUSES = FUSES;
module.exports.installSnapshots = installSnapshots;
