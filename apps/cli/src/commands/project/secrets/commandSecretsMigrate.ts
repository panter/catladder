import { getVaultConfig } from "@catladder/pipeline";
import { defineCommand } from "../../../core/defineCommand";
import { getProjectConfig } from "../../../config/getProjectConfig";
import { createVault } from "../../../vault/createVault";
import type { SecretsVault } from "../../../vault/types";
import {
  formatPlan,
  formatResult,
  planMigration,
  runMigration,
} from "./migrate";
import { parseKeysInput } from "./parseKeysInput";
import type { VaultType } from "./resolveVaultConfig";
import { resolveVaultConfig } from "./resolveVaultConfig";
import {
  getScopedSecretKeys,
  resolveSecretsScope,
  secretsScopeChoices,
} from "./scope";

const vaultTypes: VaultType[] = ["gitlab", "bitwarden"];

const parseVaultType = (value: string, option: string): VaultType => {
  if (!vaultTypes.includes(value as VaultType)) {
    throw new Error(
      `--${option}: unknown vault "${value}" — choose one of: ${vaultTypes.join(", ")}`,
    );
  }
  return value as VaultType;
};

export const commandSecretsMigrate = defineCommand({
  name: "project secrets-migrate",
  description:
    "copies the declared secrets from one vault to another (the source is never modified; no CI mirroring). Exits non-zero when a write/verification failed or when conflicts remain (re-run with --overwrite)",
  group: "project",
  inputs: {
    envComponent: {
      type: "string",
      message: "scope: env:component, env:, :component or empty for everything",
      positional: true,
      required: false,
      choices: async () => secretsScopeChoices(),
    },
    from: {
      type: "string",
      message: "source vault (default: the configured vault)",
      required: false,
      choices: async () => vaultTypes,
    },
    to: {
      type: "string",
      message: "target vault",
      required: true,
      choices: async () => vaultTypes,
    },
    fromCollection: {
      type: "string",
      message:
        "bitwarden collection of the source (default: the configured collection, else catladder)",
      required: false,
    },
    toCollection: {
      type: "string",
      message:
        "bitwarden collection of the target (default: the configured collection, else catladder)",
      required: false,
    },
    key: {
      type: "string",
      message: "only migrate these secrets (comma-separated keys)",
      required: false,
    },
    dryRun: {
      type: "boolean",
      message: "only print the plan (names and counts), write nothing",
      required: false,
    },
    overwrite: {
      type: "boolean",
      message: "overwrite secrets that differ in the target (backups are made)",
      required: false,
    },
    yes: {
      type: "boolean",
      message: "do not ask for confirmation",
      required: false,
    },
  },
  execute: async (ctx) => {
    const config = await getProjectConfig();
    const scope = await resolveSecretsScope(await ctx.get("envComponent"));
    const scoped = await getScopedSecretKeys(
      scope,
      parseKeysInput(await ctx.get("key")),
    );

    const fromType = await ctx.get("from");
    const toType = parseVaultType(await ctx.get("to"), "to");
    const configuredVault = getVaultConfig(config);

    const sourceConfig = fromType
      ? resolveVaultConfig(
          parseVaultType(fromType, "from"),
          { collection: (await ctx.get("fromCollection")) || undefined },
          config,
        )
      : configuredVault;
    const targetConfig = resolveVaultConfig(
      toType,
      { collection: (await ctx.get("toCollection")) || undefined },
      config,
    );

    const source = createVault(config, sourceConfig, ctx.interactive);
    const target = createVault(config, targetConfig, ctx.interactive);
    if (source.id === target.id) {
      throw new Error(
        `source and target are the same vault (${source.id}) — nothing to migrate`,
      );
    }

    const overwrite = Boolean(await ctx.get("overwrite"));
    ctx.log(`migrating ${source.id} → ${target.id}`);
    const plan = planMigration(
      scoped,
      await source.readAllSecrets(ctx),
      await target.readAllSecrets(ctx),
      { overwrite },
    );
    ctx.log(formatPlan(plan));

    if (await ctx.get("dryRun")) {
      ctx.log("dry run, nothing written 🏜️");
      return;
    }

    const toWrite = plan.filter(
      (e) => e.action === "create" || e.action === "overwrite",
    );
    if (toWrite.length > 0 && !(await ctx.get("yes"))) {
      if (!(await ctx.confirm(`write ${toWrite.length} secrets? 🤔`))) {
        throw new Error("abort");
      }
    }

    // when the target is the configured vault, write through its
    // manager so the local cache stays in sync. Verification reads the
    // raw target vault (never the cache). Never mirrors to CI.
    const manager = await ctx.getVaultManager();
    const writer: SecretsVault =
      target.id === manager.vault.id
        ? {
            id: target.id,
            readAllSecrets: (io) => target.readAllSecrets(io),
            writeSecrets: (io, env, componentName, secrets, options) =>
              manager.writeSecrets(env, componentName, secrets, io, options),
          }
        : target;

    const result = await runMigration(ctx, plan, writer);
    ctx.log(formatResult(result));

    if (result.failed.length > 0) {
      throw new Error(
        `😿 migration incomplete, failed: ${result.failed.join(", ")}`,
      );
    }
    if (result.conflicts.length > 0) {
      throw new Error(
        `😿 ${result.conflicts.length} conflicts left (${result.conflicts.join(", ")}) — re-run with --overwrite`,
      );
    }
    ctx.log("done! 😻");
  },
});
