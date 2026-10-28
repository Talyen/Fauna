import { readdir, open, unlink } from "node:fs/promises";
import path from "node:path";

export async function reserveBalanceDirectory(directory) {
  const marker = path.join(directory, ".balance-writing");
  let handle;
  try {
    handle = await open(marker, "wx");
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error("Choose an empty output directory; existing balance evidence is preserved.");
    throw error;
  }
  const release = async () => {
    await handle.close();
    await unlink(marker);
  };
  try {
    if ((await readdir(directory)).some((name) => name !== ".balance-writing"))
      throw new Error("Choose an empty output directory; existing balance evidence is preserved.");
  } catch (error) {
    await release();
    throw error;
  }
  return release;
}
