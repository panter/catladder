import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writePrivateFile } from "../writePrivateFile";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "private-file-test-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writePrivateFile", () => {
  it("creates the file with mode 0600", async () => {
    const path = join(dir, "a.json");
    await writePrivateFile(path, "secret");
    expect(await readFile(path, "utf-8")).toBe("secret");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("tightens an existing 0644 file and leaves no temp file behind", async () => {
    const path = join(dir, "a.json");
    await writeFile(path, "old");
    await chmod(path, 0o644);
    await writePrivateFile(path, "new");
    expect(await readFile(path, "utf-8")).toBe("new");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await readdir(dir)).toEqual(["a.json"]);
  });
});
