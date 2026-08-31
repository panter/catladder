import type { Config } from "@catladder/pipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IO } from "../../core/types";
import { writeSecretsAndMirror } from "../writeSecrets";

const { getProjectConfig, getEnvironment } = vi.hoisted(() => ({
  getProjectConfig: vi.fn(),
  getEnvironment: vi.fn(),
}));
const { upsertAllVariables } = vi.hoisted(() => ({
  upsertAllVariables: vi.fn(),
}));
const { isGhAuthenticated } = vi.hoisted(() => ({
  isGhAuthenticated: vi.fn(),
}));
const { collectSecretTargets, getConfiguredGithubRepo, pushSecretsToGithub } =
  vi.hoisted(() => ({
    collectSecretTargets: vi.fn(),
    getConfiguredGithubRepo: vi.fn(),
    pushSecretsToGithub: vi.fn(),
  }));

vi.mock("../../config/getProjectConfig", () => ({
  getProjectConfig,
  getEnvironment,
}));
vi.mock("../../utils/gitlab", () => ({ upsertAllVariables }));
vi.mock("../../utils/github", () => ({ isGhAuthenticated }));
vi.mock("../github", () => ({
  collectSecretTargets,
  getConfiguredGithubRepo,
  pushSecretsToGithub,
}));

const vaultWriteSecrets = vi.fn();
const io = {
  log: vi.fn(),
  getVaultManager: async () => ({ writeSecrets: vaultWriteSecrets }),
} as unknown as IO;

const config = (partial: Partial<Config>): Config =>
  ({
    customerName: "pan",
    appName: "app",
    components: {},
    ...partial,
  }) as Config;

const writes = [
  { env: "dev", componentName: "www", secrets: { API_KEY: "sesame" } },
];

beforeEach(() => {
  vi.clearAllMocks();
  getEnvironment.mockResolvedValue({
    secretEnvVarKeys: [{ key: "API_KEY" }],
    jobOnlyVars: {
      build: { secretEnvVarKeys: [] },
      deploy: { secretEnvVarKeys: [] },
    },
  });
  isGhAuthenticated.mockResolvedValue(true);
  getConfiguredGithubRepo.mockResolvedValue("panter/app");
  collectSecretTargets.mockResolvedValue(
    new Map([["CL_dev_www_API_KEY", new Set(["dev"])]]),
  );
});

describe("writeSecretsAndMirror", () => {
  it("never touches the gitlab api on a project without a gitlab pipeline", async () => {
    getProjectConfig.mockResolvedValue(
      config({
        pipelines: { github: true },
        secrets: { vault: { type: "bitwarden" } },
      }),
    );

    await writeSecretsAndMirror(io, writes);

    expect(vaultWriteSecrets).toHaveBeenCalledWith(
      "dev",
      "www",
      { API_KEY: "sesame" },
      io,
      {},
    );
    expect(upsertAllVariables).not.toHaveBeenCalled();
    expect(pushSecretsToGithub).toHaveBeenCalledWith(
      io,
      "panter/app",
      [{ name: "CL_dev_www_API_KEY", value: "sesame", kind: "secret" }],
      expect.any(Map),
    );
  });

  it("does not mirror to gitlab when gitlab IS the vault (already written)", async () => {
    getProjectConfig.mockResolvedValue(config({ pipelines: { gitlab: true } }));

    await writeSecretsAndMirror(io, writes);

    expect(vaultWriteSecrets).toHaveBeenCalledTimes(1);
    expect(upsertAllVariables).not.toHaveBeenCalled();
    expect(pushSecretsToGithub).not.toHaveBeenCalled();
  });

  it("mirrors to gitlab when it is only a backend, and forwards the backup option", async () => {
    getProjectConfig.mockResolvedValue(
      config({
        pipelines: { gitlab: true, github: true },
        secrets: { vault: "bitwarden" },
      }),
    );

    await writeSecretsAndMirror(io, writes, { backup: false });

    expect(vaultWriteSecrets).toHaveBeenCalledWith(
      "dev",
      "www",
      { API_KEY: "sesame" },
      io,
      { backup: false },
    );
    expect(upsertAllVariables).toHaveBeenCalledWith(
      io,
      { API_KEY: "sesame" },
      "dev",
      "www",
      false,
    );
    expect(pushSecretsToGithub).toHaveBeenCalled();
  });

  it("keeps the secrets in the vault when the github mirror cannot run", async () => {
    getProjectConfig.mockResolvedValue(
      config({
        pipelines: { github: true },
        secrets: { vault: "bitwarden" },
      }),
    );
    isGhAuthenticated.mockResolvedValue(false);

    await writeSecretsAndMirror(io, writes);

    expect(vaultWriteSecrets).toHaveBeenCalledTimes(1);
    expect(pushSecretsToGithub).not.toHaveBeenCalled();
  });
});
