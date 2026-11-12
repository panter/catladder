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

const { outsideCi } = vi.hoisted(() => ({ outsideCi: { value: false } }));
vi.mock("@catladder/pipeline", async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  deliversRuntimeSecretsOutsideCi: () => outsideCi.value,
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
  outsideCi.value = false;
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

  describe("runtime-only secrets", () => {
    const scoped = [
      { key: "SESSION_SECRET", scopes: ["runtime"] },
      { key: "DB_PASS", scopes: ["runtime", "local"] },
      { key: "NPM_TOKEN", scopes: ["build"] },
      { key: "API_KEY" },
    ];
    const scopedWrites = [
      {
        env: "dev",
        componentName: "www",
        secrets: {
          SESSION_SECRET: "s",
          DB_PASS: "d",
          NPM_TOKEN: "n",
          API_KEY: "a",
        },
      },
    ];
    beforeEach(() => {
      getEnvironment.mockResolvedValue({
        secretEnvVarKeys: scoped,
        jobOnlyVars: {
          build: { secretEnvVarKeys: [] },
          deploy: { secretEnvVarKeys: [] },
        },
      });
      getProjectConfig.mockResolvedValue(
        config({
          pipelines: { gitlab: true, github: true },
          secrets: { vault: "bitwarden" },
        }),
      );
    });

    it("reaches the vault but not CI when the deploy delivers them outside CI", async () => {
      outsideCi.value = true;
      await writeSecretsAndMirror(io, scopedWrites);

      expect(vaultWriteSecrets).toHaveBeenCalledWith(
        "dev",
        "www",
        scopedWrites[0].secrets,
        io,
        {},
      );
      expect(upsertAllVariables).toHaveBeenCalledWith(
        io,
        { NPM_TOKEN: "n", API_KEY: "a" },
        "dev",
        "www",
        true,
      );
      const pushed = pushSecretsToGithub.mock.calls[0][2].map(
        (s: { name: string }) => s.name,
      );
      expect(pushed).toEqual(["CL_dev_www_NPM_TOKEN", "CL_dev_www_API_KEY"]);
      const logs = io.log as ReturnType<typeof vi.fn>;
      const text = logs.mock.calls.map((c) => c[0]).join("\n");
      expect(text).toContain("dev:www:SESSION_SECRET");
      expect(text).not.toContain('"s"');
    });

    it("skips the gitlab call when nothing is left to mirror", async () => {
      outsideCi.value = true;
      await writeSecretsAndMirror(io, [
        { env: "dev", componentName: "www", secrets: { SESSION_SECRET: "s" } },
      ]);
      expect(upsertAllVariables).not.toHaveBeenCalled();
      expect(pushSecretsToGithub).not.toHaveBeenCalled();
    });

    it("still mirrors runtime-only secrets with the real predicate and logs a note", async () => {
      await writeSecretsAndMirror(io, scopedWrites);

      expect(upsertAllVariables).toHaveBeenCalledWith(
        io,
        scopedWrites[0].secrets,
        "dev",
        "www",
        true,
      );
      const logs = io.log as ReturnType<typeof vi.fn>;
      expect(logs.mock.calls.map((c) => c[0]).join("\n")).toContain(
        "still mirrored to CI",
      );
    });
  });
});
