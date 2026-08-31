import type { Config } from "@catladder/pipeline";
import {
  getPipelineGitRemote,
  getSecretVarName,
  GithubBackend,
} from "@catladder/pipeline";
import {
  getAllComponentsWithAllEnvsHierarchical,
  getEnvironment,
  getProjectConfig,
} from "../config/getProjectConfig";
import type { IO } from "../core/types";
import {
  ensureGithubEnvironment,
  getGithubRepoFromRemote,
  setGithubSecret,
  setGithubVariable,
} from "../utils/github";

/**
 * all secrets declared in the config, with their values read from the
 * vault (github secrets are write-only and can never act as a source)
 */
export const collectSecretsFromVault = async (io: IO, envFilter?: string[]) => {
  const envAndComponents = await getAllComponentsWithAllEnvsHierarchical();

  const kinds = new Map<string, "secret" | "variable">();
  for (const [componentName, envs] of Object.entries(envAndComponents)) {
    for (const env of envs) {
      if (envFilter && !envFilter.includes(env)) {
        continue;
      }
      const { secretEnvVarKeys, jobOnlyVars } = await getEnvironment(
        env,
        componentName,
      );
      const keys = [
        ...secretEnvVarKeys,
        ...jobOnlyVars.build.secretEnvVarKeys,
        ...jobOnlyVars.deploy.secretEnvVarKeys,
      ];
      keys.forEach(({ key, kind }) =>
        kinds.set(getSecretVarName(env, componentName, key), kind ?? "secret"),
      );
    }
  }

  const names = [...kinds.keys()];
  const values = await (await io.getVaultManager()).readSecrets(names, io);
  const secrets = names
    .filter((name) => values[name] !== undefined)
    .map((name) => ({
      name,
      value: values[name],
      kind: kinds.get(name) ?? ("secret" as const),
    }));
  const missing = names.filter((name) => values[name] === undefined);
  return { secrets, missing };
};

/** marker for repo-level (environment-less) targets */
const REPO_LEVEL = "";

/**
 * derives which github environment(s) each secret/variable must live in
 * by scanning the GENERATED workflows: a `${{ secrets.X }}` / `${{
 * vars.X }}` reference in a job's env targets that job's environment
 * (or the repo level when the job has none). Deriving from the real
 * output means the sync can never drift from what the workflows expect.
 *
 * Environment secrets are the answer to github's cap of 100 secrets
 * per REPO (a multi-env project easily exceeds it): the cap applies
 * per environment instead.
 */
export const collectSecretTargets = async (
  config: Config,
): Promise<Map<string, Set<string>>> => {
  const workflows = await new GithubBackend().createWorkflows(config);
  const targets = new Map<string, Set<string>>();
  for (const workflow of Object.values(workflows)) {
    for (const job of Object.values(workflow.jobs)) {
      const environment =
        typeof job.environment === "object"
          ? job.environment.name
          : job.environment;
      for (const value of Object.values(job.env ?? {})) {
        if (typeof value !== "string") continue;
        for (const match of value.matchAll(
          /\$\{\{\s*(?:secrets|vars)\.([A-Za-z0-9_]+)\s*\}\}/g,
        )) {
          const name = match[1];
          if (!targets.has(name)) {
            targets.set(name, new Set());
          }
          targets.get(name)!.add(environment ?? REPO_LEVEL);
        }
      }
    }
  }
  return targets;
};

/**
 * pushes vault values to github via the gh cli: sensitive ones as
 * secrets (masked), "variable"-kind ones as variables (plain) — each
 * into the environment(s) whose jobs reference them
 */
export const pushSecretsToGithub = async (
  io: IO,
  repo: string,
  secrets: { name: string; value: string; kind: "secret" | "variable" }[],
  targets: Map<string, Set<string>>,
) => {
  const environments = [
    ...new Set(
      [...targets.values()].flatMap((envs) =>
        [...envs].filter((env) => env !== REPO_LEVEL),
      ),
    ),
  ];
  for (const environment of environments) {
    await ensureGithubEnvironment(repo, environment);
    io.log(`🌍 environment ${environment}`);
  }

  for (const { name, value, kind } of secrets) {
    const envs = targets.get(name);
    if (!envs) {
      io.log(`⏭️ ${name} (not referenced by any generated workflow)`);
      continue;
    }
    for (const environment of envs) {
      const suffix = environment === REPO_LEVEL ? "" : ` → ${environment}`;
      if (kind === "variable") {
        await setGithubVariable(repo, name, value, environment || undefined);
        io.log(`📖 ${name} (variable)${suffix}`);
      } else {
        await setGithubSecret(repo, name, value, environment || undefined);
        io.log(`✅ ${name}${suffix}`);
      }
    }
  }
};

/**
 * resolves the github repository from the configured git remote
 * (`pipelines.github.gitRemote`, defaults to origin)
 */
export const getConfiguredGithubRepo = async (): Promise<
  string | undefined
> => {
  const config = await getProjectConfig();
  if (!config) {
    return undefined;
  }
  return getGithubRepoFromRemote(getPipelineGitRemote(config, "github"));
};
