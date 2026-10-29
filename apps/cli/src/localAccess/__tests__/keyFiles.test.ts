import { mkdtemp, mkdir, readFile, stat, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@catladder/pipeline";
import { getSecretVarName } from "@catladder/pipeline";

let root: string;
vi.mock("../../git/gitProjectInformation", () => ({
  getProjectRootPath: async () => root,
}));

import {
  getLocalAccessKeyFileName,
  getLocalAccessKeyFileVarName,
  writeLocalAccessKeyFiles,
} from "../keyFiles";

const cloudRun = {
  type: "google-cloudrun",
  projectId: "p",
  region: "r",
} as any;

const config = (extra: Partial<Config>): Config =>
  ({
    appName: "app",
    customerName: "acme",
    components: { web: { dir: ".", build: false, deploy: cloudRun } },
    ...extra,
  }) as Config;

const ioWith = (secrets: Record<string, string>) => {
  const logs: string[] = [];
  return {
    logs,
    io: {
      log: (m: string) => logs.push(m),
      getVaultManager: async () => ({ readSecrets: async () => secrets }),
    } as any,
  };
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keyfiles-test-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("local access key file naming", () => {
  it("derives a file name per env and component", () => {
    expect(getLocalAccessKeyFileName("review", "web-app")).toBe(
      "gcp-review-web_app.json",
    );
  });
  it("exposes the path under a var that is not GOOGLE_APPLICATION_CREDENTIALS", () => {
    expect(getLocalAccessKeyFileVarName("review")).toBe(
      "CATLADDER_LOCAL_ACCESS_GCP_REVIEW_KEY_FILE",
    );
  });
});

describe("writeLocalAccessKeyFiles", () => {
  const secretName = getSecretVarName(
    "local",
    "web",
    "LOCAL_ACCESS_GCP_DEV_CREDENTIALS",
  );
  const declared = config({
    environments: { dev: { localAccess: { gcp: { presets: ["logs"] } } } },
  });

  it("creates nothing without a declaration", async () => {
    const { io } = ioWith({});
    await writeLocalAccessKeyFiles(io, config({}));
    expect(existsSync(join(root, ".catladder"))).toBe(false);
  });

  it("does not throw on an invalid declaration", async () => {
    const { io } = ioWith({});
    await writeLocalAccessKeyFiles(
      io,
      config({ localAccess: { gcp: { roles: ["roles/owner"] } } }),
    );
    expect(existsSync(join(root, ".catladder"))).toBe(false);
  });

  it("writes the key with mode 0600 and removes stale files", async () => {
    const folder = join(root, ".catladder", "local-access");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "stale.json"), "x");
    const { io } = ioWith({ [secretName]: '{"private_key_id":"a"}' });
    await writeLocalAccessKeyFiles(io, declared);
    const file = join(folder, "gcp-dev-web.json");
    expect(await readFile(file, "utf-8")).toBe('{"private_key_id":"a"}');
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(existsSync(join(folder, "stale.json"))).toBe(false);
  });

  it("warns when the key is missing", async () => {
    const { io, logs } = ioWith({});
    await writeLocalAccessKeyFiles(io, declared);
    expect(logs.join("\n")).toMatch(/no local access key for dev:web/);
  });
});
