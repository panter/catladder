import { chmod, mkdtemp, mkdir, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: string;
vi.mock("../../git/gitProjectInformation", () => ({
  getProjectRootPath: async () => root,
}));

import { readSecretsCache, writeSecretsCache } from "../cache";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "cache-test-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("secrets cache", () => {
  it("is written with mode 0600", async () => {
    await writeSecretsCache("v", { local: { web: { KEY: "value" } } });
    const mode = (await stat(join(root, ".catladder", "secrets.json"))).mode;
    expect(mode & 0o777).toBe(0o600);
    expect((await readSecretsCache())?.secrets.local.web.KEY).toBe("value");
  });

  it("tightens an existing world-readable cache", async () => {
    const folder = join(root, ".catladder");
    await mkdir(folder);
    const path = join(folder, "secrets.json");
    await writeFile(path, "{}");
    await chmod(path, 0o644);
    await writeSecretsCache("v", { local: { web: { KEY: "value" } } });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
