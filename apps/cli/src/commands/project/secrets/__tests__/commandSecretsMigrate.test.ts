import { getSecretVarName } from "@catladder/pipeline";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  resolveSecretsScope: vi.fn(async () => ({})),
  secretsScopeChoices: async () => [],
  getScopedSecretKeys: vi.fn(async () => [
    { env: "local", componentName: "web", keys: ["API_KEY"] },
  ]),
}));
vi.mock("../../../../vault/createVault", () => ({
  createVault: vi.fn(
    (_c: unknown, vc: { type: string }) => mocks.vaults[vc.type],
  ),
}));

vi.mock("../../../../secrets/writeSecrets", () => ({
  writeSecretsAndMirror: vi.fn(),
}));

import { writeSecretsAndMirror } from "../../../../secrets/writeSecrets";
import { createVault } from "../../../../vault/createVault";
import { getScopedSecretKeys, resolveSecretsScope } from "../scope";
import { commandSecretsMigrate } from "../commandSecretsMigrate";
import { FILL_ME } from "../document";

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
    vi.clearAllMocks();
    gitlab = fake("gitlab", { [NAME]: "s3cret" });
    bitwarden = fake("bitwarden:catladder");
    mocks.vaults = { gitlab, bitwarden };
    mocks.configured = { type: "gitlab" };
  });

  afterEach(() => {
    expect(gitlab.writeSecrets).not.toHaveBeenCalled();
    expect(writeSecretsAndMirror).not.toHaveBeenCalled();
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
    const { ctx, promise } = await run(
      { to: "bitwarden", dryRun: true },
      gitlab,
    );
    await promise;
    expect(bitwarden.writeSecrets).not.toHaveBeenCalled();
    expect(ctx.confirm).not.toHaveBeenCalled();
  });

  it("throws on conflicts without --overwrite", async () => {
    bitwarden = fake("bitwarden:catladder", { [NAME]: "other" });
    mocks.vaults = { gitlab, bitwarden };
    const { promise } = await run({ to: "bitwarden", yes: true }, gitlab);
    await expect(promise).rejects.toThrow(/conflicts/);
    expect(bitwarden.writeSecrets).not.toHaveBeenCalled();
  });

  it("asks for confirmation and writes after acceptance", async () => {
    const { ctx, promise } = await run({ to: "bitwarden" }, gitlab);
    await expect(promise).resolves.toBeUndefined();
    expect(ctx.confirm).toHaveBeenCalledOnce();
    expect(ctx.confirm).toHaveBeenCalledWith("write 1 secrets? 🤔");
    expect(bitwarden.writeSecrets).toHaveBeenCalledOnce();
  });

  it("overwrites a conflict with a backup when requested", async () => {
    bitwarden = fake("bitwarden:catladder", { [NAME]: "old-target-value" });
    mocks.vaults.bitwarden = bitwarden;
    const { ctx, promise } = await run(
      { to: "bitwarden", overwrite: true, yes: true },
      gitlab,
    );
    await expect(promise).resolves.toBeUndefined();
    expect(bitwarden.writeSecrets).toHaveBeenCalledWith(
      expect.anything(),
      "local",
      "web",
      { API_KEY: "s3cret" },
      { backup: true },
    );
    expect(await bitwarden.readAllSecrets(ctx as any)).toEqual({
      [NAME]: "s3cret",
    });
    const output = JSON.stringify(ctx.log.mock.calls);
    expect(output).not.toContain("s3cret");
    expect(output).not.toContain("old-target-value");
  });

  it.each([undefined, "", FILL_ME, "s3cret"])(
    "skips an unset or equal source (%s) without prompting",
    async (value) => {
      vi.mocked(gitlab.readAllSecrets).mockResolvedValue(
        value === undefined ? {} : { [NAME]: value },
      );
      bitwarden = fake("bitwarden:catladder", { [NAME]: "s3cret" });
      mocks.vaults.bitwarden = bitwarden;
      const { ctx, promise } = await run({ to: "bitwarden" }, gitlab);
      await expect(promise).resolves.toBeUndefined();
      expect(ctx.confirm).not.toHaveBeenCalled();
      expect(bitwarden.writeSecrets).not.toHaveBeenCalled();
      expect(bitwarden.readAllSecrets).toHaveBeenCalledOnce();
    },
  );

  it("sanitizes verification read errors after a successful write", async () => {
    vi.mocked(bitwarden.readAllSecrets)
      .mockImplementationOnce(async () => ({}))
      .mockImplementationOnce(async (io) => {
        io.log("verification-backend-secret");
        throw new Error("verification-error-secret");
      });
    const { ctx, promise } = await run({ to: "bitwarden", yes: true }, gitlab);
    const error = await promise.catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("local:web:API_KEY");
    expect(bitwarden.writeSecrets).toHaveBeenCalledOnce();
    const output = JSON.stringify(ctx.log.mock.calls) + error.message;
    for (const value of [
      "s3cret",
      "verification-backend-secret",
      "verification-error-secret",
    ]) {
      expect(output).not.toContain(value);
    }
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
  it("passes the scope and comma-separated key filter to the shared helpers", async () => {
    const { promise } = await run(
      {
        to: "bitwarden",
        envComponent: "local:web",
        key: " API_KEY, SMTP ",
        dryRun: true,
      },
      gitlab,
    );
    await promise;
    expect(resolveSecretsScope).toHaveBeenCalledWith("local:web");
    expect(getScopedSecretKeys).toHaveBeenCalledWith({}, ["API_KEY", "SMTP"]);
  });

  it("honors --from-collection when --from defaults to the configured vault", async () => {
    mocks.configured = { type: "bitwarden", collection: "configured" };
    const { promise } = await run(
      { to: "gitlab", fromCollection: "source-override", dryRun: true },
      bitwarden,
    );
    await promise;
    expect(createVault).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      { type: "bitwarden", collection: "source-override" },
      false,
    );
  });

  it("reports dry-run conflicts without prompting or writing", async () => {
    mocks.vaults.bitwarden = fake("bitwarden:catladder", {
      [NAME]: "existing",
    });
    const { ctx, promise } = await run(
      { to: "bitwarden", dryRun: true },
      gitlab,
    );
    await expect(promise).rejects.toThrow("local:web:API_KEY");
    expect(ctx.confirm).not.toHaveBeenCalled();
    expect(mocks.vaults.bitwarden.writeSecrets).not.toHaveBeenCalled();
  });

  it.each(["gitlab", "bitwarden"])(
    "hides backend read diagnostics for %s",
    async (type) => {
      mocks.vaults[type].readAllSecrets.mockImplementation(async (io: any) => {
        io.log("unrelated-secret-from-backend");
        throw new Error("encoded-secret-from-backend");
      });
      const { ctx, promise } = await run(
        { to: "bitwarden", yes: true },
        gitlab,
      );
      const error = await promise.catch((e: Error) => e);
      expect(error.message).toContain("local:web:API_KEY");
      expect(JSON.stringify(ctx.log.mock.calls) + error.message).not.toContain(
        "secret-from-backend",
      );
      expect(bitwarden.writeSecrets).not.toHaveBeenCalled();
    },
  );

  it("hides backend write diagnostics and reports the failed entry", async () => {
    vi.mocked(bitwarden.writeSecrets).mockImplementation(async (io) => {
      io.log("old-target-secret");
      throw new Error("encoded-unrelated-secret");
    });
    const { ctx, promise } = await run({ to: "bitwarden", yes: true }, gitlab);
    const error = await promise.catch((e: Error) => e);
    expect(error.message).toContain("local:web:API_KEY");
    const output = JSON.stringify(ctx.log.mock.calls) + error.message;
    expect(output).not.toContain("old-target-secret");
    expect(output).not.toContain("encoded-unrelated-secret");
    expect(writeSecretsAndMirror).not.toHaveBeenCalled();
  });

  it("verification uses a second raw read even with a configured target manager", async () => {
    mocks.configured = { type: "bitwarden" };
    vi.mocked(bitwarden.readAllSecrets).mockResolvedValue({});
    const { manager, promise } = await run(
      { from: "gitlab", to: "bitwarden", yes: true },
      bitwarden,
    );
    await expect(promise).rejects.toThrow("local:web:API_KEY");
    expect(manager.writeSecrets).toHaveBeenCalledOnce();
    expect(bitwarden.readAllSecrets).toHaveBeenCalledTimes(2);
  });
});
