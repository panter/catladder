import type { Config } from "@catladder/pipeline";
import {
  getEnabledPipelineTypes,
  getSecretVarName,
  getVaultConfig,
} from "@catladder/pipeline";
import {
  getEnvironment,
  getProjectConfig,
} from "../../../config/getProjectConfig";
import type { IO } from "../../../core/types";
import { isGhAuthenticated } from "../../../utils/github";
import { upsertAllVariables } from "../../../utils/gitlab";
import {
  collectSecretTargets,
  getConfiguredGithubRepo,
  pushSecretsToGithub,
} from "../commandSecretsSyncGithub";
import type { ScopedSecretKeys } from "./scope";

/** placeholder for secrets that have no value in the vault yet */
export const FILL_ME = "🚨 FILL ME";

/**
 * component → env → key → value: the document shape shared by the
 * editor, `secrets-pull` and `secrets-push`
 */
export type SecretsDocument = {
  [componentName: string]: {
    [env: string]: Record<string, unknown>;
  };
};

/** secrets of one env of one component, ready to be written */
export type SecretsWrite = {
  env: string;
  componentName: string;
  secrets: Record<string, unknown>;
};

/* for convenience, parse json values. that makes it easier to edit secrets that are objects */
const parseJsonValue = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

/**
 * builds the document for the given scope with the current values from
 * the vault; unset secrets appear as the FILL_ME placeholder
 */
export const buildSecretsDocument = async (
  io: IO,
  scoped: ScopedSecretKeys,
): Promise<SecretsDocument> => {
  const names = scoped.flatMap(({ env, componentName, keys }) =>
    keys.map((key) => getSecretVarName(env, componentName, key)),
  );
  const values = await (await io.getVaultManager()).readSecrets(names, io);

  const document: SecretsDocument = {};
  for (const { env, componentName, keys } of scoped) {
    document[componentName] ??= {};
    document[componentName][env] = Object.fromEntries(
      keys.map((key) => {
        const value = values[getSecretVarName(env, componentName, key)];
        return [key, value === undefined ? FILL_ME : parseJsonValue(value)];
      }),
    );
  }
  return document;
};

/**
 * validates a document against the scope. Undeclared components, envs
 * or keys are always problems; missing keys only when `requireComplete`
 * (the guided editor flow) — pushes may be partial.
 */
export const checkSecretsDocument = (
  document: SecretsDocument,
  scoped: ScopedSecretKeys,
  { requireComplete }: { requireComplete: boolean },
): string[] => {
  const problems: string[] = [];

  const scopedKeys = new Map<string, string[]>();
  scoped.forEach(({ env, componentName, keys }) =>
    scopedKeys.set(`${env}:${componentName}`, keys),
  );
  const scopedComponents = new Set(scoped.map((s) => s.componentName));

  for (const [componentName, envs] of Object.entries(document ?? {})) {
    if (!scopedComponents.has(componentName)) {
      problems.push(
        `"${componentName}" is not a component in this scope — remove it or widen the scope`,
      );
      continue;
    }
    for (const [env, secrets] of Object.entries(envs ?? {})) {
      const keys = scopedKeys.get(`${env}:${componentName}`);
      if (!keys) {
        problems.push(
          `"${env}:${componentName}" is not in this scope — remove it or widen the scope`,
        );
        continue;
      }
      const extraneous = Object.keys(secrets ?? {}).filter(
        (key) => !keys.includes(key),
      );
      extraneous.forEach((key) =>
        problems.push(
          `"${env}:${componentName}": "${key}" is not declared in the config (or filtered out by --key)`,
        ),
      );
    }
  }

  if (requireComplete) {
    for (const { env, componentName, keys } of scoped) {
      const provided = Object.keys(document?.[componentName]?.[env] ?? {});
      keys
        .filter((key) => !provided.includes(key))
        .forEach((key) =>
          problems.push(
            `"${env}:${componentName}": "${key}" has not been provided`,
          ),
        );
    }
  }

  return problems;
};

/**
 * turns a (validated) document into writes. FILL_ME placeholders and
 * empty (null) values are skipped, so an untouched placeholder can
 * never end up as a live secret value.
 */
export const collectSecretsWrites = (
  document: SecretsDocument,
  scoped: ScopedSecretKeys,
): { writes: SecretsWrite[]; skipped: string[] } => {
  const writes: SecretsWrite[] = [];
  const skipped: string[] = [];
  for (const { env, componentName, keys } of scoped) {
    const provided = document?.[componentName]?.[env] ?? {};
    const secrets: Record<string, unknown> = {};
    for (const key of keys) {
      if (!(key in provided)) {
        continue;
      }
      const value = provided[key];
      if (value === FILL_ME || value === null || value === undefined) {
        skipped.push(`${env}:${componentName} ${key}`);
        continue;
      }
      secrets[key] = value;
    }
    if (Object.keys(secrets).length > 0) {
      writes.push({ env, componentName, secrets });
    }
  }
  return { writes, skipped };
};

/**
 * writes secrets to the vault (the source of truth) and mirrors them
 * to every enabled CI backend — which backends exist is invisible to
 * the caller
 */
export const writeSecretsAndMirror = async (
  io: IO,
  writes: SecretsWrite[],
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
    ).writeSecrets(env, componentName, secrets);
    io.log("");
    io.log("✅ " + env + ":" + componentName);
    io.log("--------------------------------\n");
  }

  await mirrorSecretsToCiBackends(io, config, writes);
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
) => {
  const enabled = getEnabledPipelineTypes(config);

  // gitlab mirror (unless gitlab is the vault itself, then it is
  // already written)
  if (getVaultConfig(config).type !== "gitlab" && enabled.includes("gitlab")) {
    for (const { env, componentName, secrets } of writes) {
      await upsertAllVariables(io, secrets, env, componentName);
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
