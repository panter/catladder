import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IO } from "../../core/types";
import { collectSecretsFromVault } from "../github";

const { getProjectConfig, getEnvironment, getAll } = vi.hoisted(() => ({
  getProjectConfig: vi.fn(),
  getEnvironment: vi.fn(),
  getAll: vi.fn(),
}));
const { outsideCi } = vi.hoisted(() => ({ outsideCi: { value: true } }));

vi.mock("@catladder/pipeline", async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  deliversRuntimeSecretsOutsideCi: () => outsideCi.value,
}));
vi.mock("../../config/getProjectConfig", () => ({
  getProjectConfig,
  getEnvironment,
  getAllComponentsWithAllEnvsHierarchical: getAll,
}));
vi.mock("../../utils/github", () => ({}));

const readSecrets = vi.fn();
const io = {
  log: vi.fn(),
  getVaultManager: async () => ({ readSecrets }),
} as unknown as IO;

beforeEach(() => {
  vi.clearAllMocks();
  outsideCi.value = true;
  getProjectConfig.mockResolvedValue({ components: { www: {} } });
  getAll.mockResolvedValue({ www: ["dev"] });
  getEnvironment.mockResolvedValue({
    secretEnvVarKeys: [
      { key: "API_KEY" },
      { key: "NPM_TOKEN", scopes: ["build"] },
      { key: "SESSION_SECRET", scopes: ["runtime"] },
      { key: "DB_PASS", scopes: ["runtime", "local"] },
    ],
    jobOnlyVars: {
      build: { secretEnvVarKeys: [{ key: "JOB_TOKEN" }] },
      deploy: { secretEnvVarKeys: [] },
    },
  });
  readSecrets.mockImplementation(async (names: string[]) =>
    Object.fromEntries(names.map((n) => [n, "v"])),
  );
});

describe("collectSecretsFromVault scope filtering", () => {
  it("neither reads nor returns runtime-only secrets", async () => {
    const { secrets, skipped, missing } = await collectSecretsFromVault(io);
    const names = secrets.map((s) => s.name);
    expect(names.some((n) => n.endsWith("API_KEY"))).toBe(true);
    expect(names.some((n) => n.endsWith("NPM_TOKEN"))).toBe(true);
    expect(names.some((n) => n.endsWith("JOB_TOKEN"))).toBe(true);
    expect(names.some((n) => n.endsWith("SESSION_SECRET"))).toBe(false);
    expect(names.some((n) => n.endsWith("DB_PASS"))).toBe(false);
    expect(skipped).toHaveLength(2);
    expect(missing).toEqual([]);
    const read = readSecrets.mock.calls[0][0] as string[];
    expect(read.some((n) => n.endsWith("SESSION_SECRET"))).toBe(false);
  });

  it("keeps runtime-only secrets while the deploy reads them from CI", async () => {
    outsideCi.value = false;
    const { secrets, skipped } = await collectSecretsFromVault(io);
    expect(secrets).toHaveLength(5);
    expect(skipped).toEqual([]);
  });
});
