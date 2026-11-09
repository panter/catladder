import { getSecretVarName } from "@catladder/pipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SecretsVault } from "../../../../vault/types";

const mocks = vi.hoisted(() => ({
  vaults: {} as Record<string, any>,
  configured: { type: "gitlab" } as any,
}));

vi.mock("../../../../config/getProjectConfig", () => ({
  getProjectConfig: async () => ({ components: {} }),
}));
vi.mock("@catladder/pipeline", async (orig) => ({
  ...(await orig<any>()),
  getVaultConfig: () => mocks.configured,
}));
vi.mock("../scope", () => ({
  resolveSecretsScope: async () => ({}),
  secretsScopeChoices: async () => [],
  getScopedSecretKeys: async () => [
    { env: "local", componentName: "web", keys: ["API_KEY"] },
  ],
}));
vi.mock("../../../../vault/createVault", () => ({
  createVault: (_c: unknown, vc: { type: string }) => mocks.vaults[vc.type],
}));

vi.mock("../../../../secrets/writeSecrets", () => ({
  writeSecretsAndMirror: vi.fn(),
}));

import { writeSecretsAndMirror } from "../../../../secrets/writeSecrets";
import { commandSecretsMigrate } from "../commandSecretsMigrate";

const NAME = getSecretVarName("local", "web", "API_KEY");

const fake = (id: string, initial: Record<string, string> = {}) => {
  const store = { ...initial };
  const vault: SecretsVault = {
    id,
    readAllSecrets: vi.fn(async () => ({ ...store })),
    writeSecrets: vi.fn(async (_io, env, c, secrets) => {
      for (const [k, v] of Object.entries(secrets))
        store[getSecretVarName(env, c, k)] = String(v);
    }),
  };
  return vault;
};

const run = async (
  inputs: Record<string, unknown>,
  managerVault: SecretsVault,
) => {
  const manager = {
    vault: managerVault,
    writeSecrets: vi.fn(
      async (env: string, c: string, s: any, io: any, o: any) =>
        managerVault.writeSecrets(io, env, c, s, o),
    ),
  };
  const ctx = {
    interactive: false,
    log: vi.fn(),
    confirm: vi.fn(async () => true),
    getVaultManager: async () => manager,
    get: async (k: string) => inputs[k],
  };
  const exec = commandSecretsMigrate.execute as (c: any) => Promise<void>;
  return { manager, ctx, promise: exec(ctx) };
};

describe("project secrets-migrate", () => {
  let gitlab: SecretsVault;
  let bitwarden: SecretsVault;
  beforeEach(() => {
    gitlab = fake("gitlab", { [NAME]: "s3cret" });
    bitwarden = fake("bitwarden:catladder");
    mocks.vaults = { gitlab, bitwarden };
    mocks.configured = { type: "gitlab" };
  });

  it("writes to a non-configured target without cache write-through", async () => {
    const { manager, promise } = await run(
      { to: "bitwarden", yes: true },
      gitlab,
    );
    await promise;
    expect(bitwarden.writeSecrets).toHaveBeenCalledOnce();
    expect(manager.writeSecrets).not.toHaveBeenCalled();
    expect(gitlab.writeSecrets).not.toHaveBeenCalled();
  });

  it("writes through the manager when the target is the configured vault", async () => {
    mocks.configured = { type: "bitwarden" };
    const { manager, promise } = await run(
      { from: "gitlab", to: "bitwarden", yes: true },
      bitwarden,
    );
    await promise;
    expect(manager.writeSecrets).toHaveBeenCalledOnce();
  });

  it("rejects identical source and target before reading", async () => {
    const { promise } = await run({ from: "gitlab", to: "gitlab" }, gitlab);
    await expect(promise).rejects.toThrow(/same vault/);
    expect(gitlab.readAllSecrets).not.toHaveBeenCalled();
  });

  it("dry run writes nothing", async () => {
    const { promise } = await run({ to: "bitwarden", dryRun: true }, gitlab);
    await promise;
    expect(bitwarden.writeSecrets).not.toHaveBeenCalled();
  });

  it("throws on conflicts without --overwrite", async () => {
    bitwarden = fake("bitwarden:catladder", { [NAME]: "other" });
    mocks.vaults = { gitlab, bitwarden };
    const { promise } = await run({ to: "bitwarden", yes: true }, gitlab);
    await expect(promise).rejects.toThrow(/conflicts/);
    expect(bitwarden.writeSecrets).not.toHaveBeenCalled();
  });

  it("aborts when the confirmation is declined", async () => {
    const { ctx, promise } = await run({ to: "bitwarden" }, gitlab);
    ctx.confirm.mockResolvedValueOnce(false);
    await expect(promise).rejects.toThrow(/abort/);
    expect(ctx.confirm).toHaveBeenCalledOnce();
    expect(bitwarden.writeSecrets).not.toHaveBeenCalled();
  });

  it("--yes skips the confirmation", async () => {
    const { ctx, promise } = await run({ to: "bitwarden", yes: true }, gitlab);
    await promise;
    expect(ctx.confirm).not.toHaveBeenCalled();
  });

  it("never logs or throws secret values, and never mirrors to CI", async () => {
    bitwarden = fake("bitwarden:catladder", { [NAME]: "other-s3cret" });
    mocks.vaults = { gitlab, bitwarden };
    const { ctx, promise } = await run({ to: "bitwarden", yes: true }, gitlab);
    const err = await promise.catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const output = JSON.stringify(ctx.log.mock.calls) + (err as Error).message;
    expect(output).not.toContain("s3cret");
    expect(writeSecretsAndMirror).not.toHaveBeenCalled();
  });
});
