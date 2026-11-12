import { chmod, rename, rm, writeFile } from "fs/promises";

/**
 * writes a file readable by the owner only. Goes through a 0600 temp
 * file and a rename, so the content is never visible with looser
 * permissions (writing first and chmod-ing afterwards would leave an
 * existing 0644 file readable until the chmod).
 */
export const writePrivateFile = async (path: string, content: string) => {
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, content, { mode: 0o600 });
    // the mode is only applied when the file is created
    await chmod(tmp, 0o600);
    await rename(tmp, path);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
};
