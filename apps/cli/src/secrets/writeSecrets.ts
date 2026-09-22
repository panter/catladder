import type { Config } from "@catladder/pipeline";
import {
  getEnabledPipelineTypes,
  getSecretVarName,
  getVaultConfig,
} from "@catladder/pipeline";
import { getEnvironment, getProjectConfig } from "../config/getProjectConfig";
import type { IO } from "../core/types";
import { isGhAuthenticated } from "../utils/github";
import { upsertAllVariables } from "../utils/gitlab";
import type { WriteSecretsOptions } from "../vault/types";
import {
  collectSecretTargets,
  getConfiguredGithubRepo,
  pushSecretsToGithub,
} from "./github";

/** secrets of one env of one component, ready to be written */
export type SecretsWrite = {
  env: string;
  componentName: string;
  secrets: Record<string, unknown>;
};

/**
 * the one door for writing secret values: they go into the vault (the
 * source of truth) and are mirrored to every enabled CI backend —
 * which vault and which backends exist is invisible to the caller.
 *
 * Everything that produces a secret value must come through here: the
 * secrets commands, but also the credentials `project setup`
 * provisions (gcloud service account keys, kubernetes tokens).
 */
export const writeSecretsAndMirror = async (
  io: IO,
  writes: SecretsWrite[],
  options: WriteSecretsOptions = {},
): Promise<void> => {
  const config = await getProjectConfig();
  if (!config) {
    throw new Error("no catladder config found");
  }

  io.log("");
  io.log("writing secrets to the vault, please wait...");
  io.log("");
  for (const { env, componentName, secrets } of writes) {
    io.log("writing " + env + ":" + componentName + "...\n");
    await (
      await io.getVaultManager()
    ).writeSecrets(env, componentName, secrets, io, options);
    io.log("");
    io.log("✅ " + env + ":" + componentName);
    io.log("--------------------------------\n");
  }

  await mirrorSecretsToCiBackends(io, config, writes, options);
};

/**
 * the vault is the source of truth; every enabled CI backend receives
 * a mirrored copy of the written secrets (gitlab variables, github
 * secrets), so all CI systems stay in sync
 */
const mirrorSecretsToCiBackends = async (
  io: IO,
  config: Config,
  writes: SecretsWrite[],
  options: WriteSecretsOptions,
) => {
  const enabled = getEnabledPipelineTypes(config);

  // gitlab mirror (unless gitlab is the vault itself, then it is
  // already written)
  if (getVaultConfig(config).type !== "gitlab" && enabled.includes("gitlab")) {
    for (const { env, componentName, secrets } of writes) {
      await upsertAllVariables(
        io,
        secrets,
        env,
        componentName,
        options.backup ?? true,
      );
    }
    io.log("✅ mirrored to gitlab");
  }

  if (!enabled.includes("github")) {
    return;
  }
  const kinds = new Map<string, "secret" | "variable">();
  for (const { env, componentName } of writes) {
    const { secretEnvVarKeys, jobOnlyVars } = await getEnvironment(
      env,
      componentName,
    );
    [
      ...secretEnvVarKeys,
      ...jobOnlyVars.build.secretEnvVarKeys,
      ...jobOnlyVars.deploy.secretEnvVarKeys,
    ].forEach(({ key, kind }) =>
      kinds.set(getSecretVarName(env, componentName, key), kind ?? "secret"),
    );
  }
  const secrets = writes.flatMap(({ env, componentName, secrets }) =>
    Object.entries(secrets).map(([key, value]) => {
      const name = getSecretVarName(env, componentName, key);
      return {
        name,
        value: typeof value === "string" ? value : JSON.stringify(value ?? ""),
        kind: kinds.get(name) ?? ("secret" as const),
      };
    }),
  );
  if (secrets.length === 0) {
    return;
  }
  if (!(await isGhAuthenticated())) {
    io.log(
      "⚠️ github pipeline is enabled, but the github cli (gh) is not authenticated — run `project secrets-sync-github` later to mirror the secrets",
    );
    return;
  }
  const repo = await getConfiguredGithubRepo();
  if (!repo) {
    io.log(
      "⚠️ github pipeline is enabled, but no github repository was found — run `project secrets-sync-github` later to mirror the secrets",
    );
    return;
  }
  io.log(`mirroring ${secrets.length} secrets to github ('${repo}')...`);
  await pushSecretsToGithub(
    io,
    repo,
    secrets,
    await collectSecretTargets(config),
  );
};
