import {
  getEnabledPipelineTypes,
  getPipelineGitRemote,
  getSecretVarName,
} from "@catladder/pipeline";
import {
  getAllComponentsWithAllEnvsHierarchical,
  getEnvironment,
  getProjectConfig,
} from "../../config/getProjectConfig";
import { defineCommand } from "../../core/defineCommand";
import type { IO } from "../../core/types";
import {
  getGithubRepoFromRemote,
  isGhAuthenticated,
  setGithubSecret,
} from "../../utils/github";

/**
 * all secrets declared in the config, with their values read from the
 * vault (github secrets are write-only and can never act as a source)
 */
export const collectSecretsFromVault = async (io: IO) => {
  const envAndComponents = await getAllComponentsWithAllEnvsHierarchical();

  const names: string[] = [];
  for (const [componentName, envs] of Object.entries(envAndComponents)) {
    for (const env of envs) {
      const { secretEnvVarKeys, jobOnlyVars } = await getEnvironment(
        env,
        componentName,
      );
      const keys = [
        ...secretEnvVarKeys,
        ...jobOnlyVars.build.secretEnvVarKeys,
        ...jobOnlyVars.deploy.secretEnvVarKeys,
      ];
      keys.forEach(({ key }) =>
        names.push(getSecretVarName(env, componentName, key)),
      );
    }
  }

  const values = await (await io.getVaultManager()).readSecrets(names, io);
  const secrets = names
    .filter((name) => values[name] !== undefined)
    .map((name) => ({ name, value: values[name] }));
  const missing = names.filter((name) => values[name] === undefined);
  return { secrets, missing };
};

/**
 * pushes secrets to github repository secrets via the gh cli
 */
export const pushSecretsToGithub = async (
  io: IO,
  repo: string,
  secrets: { name: string; value: string }[],
) => {
  for (const { name, value } of secrets) {
    await setGithubSecret(repo, name, value);
    io.log(`✅ ${name}`);
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

/**
 * copies the catladder secrets from the vault to github actions
 * repository secrets, keeping the exact same names, so the github
 * pipeline can reference them as ${{ secrets.<NAME> }}.
 */
export const commandSecretsSyncGithub = defineCommand({
  name: "project secrets-sync-github",
  description:
    "copies all secrets from the vault to github repo secrets (same names), for the github pipeline",
  group: "project",
  inputs: {
    repo: {
      type: "string",
      message: "github repository (owner/name)",
      positional: true,
      required: false,
    },
  },
  execute: async (ctx) => {
    const config = await getProjectConfig();
    if (!config) {
      throw new Error("no catladder config found");
    }
    const enabled = getEnabledPipelineTypes(config);
    if (!enabled.includes("github")) {
      throw new Error(
        "the github pipeline is not enabled in `pipelines` — nothing to sync to",
      );
    }
    if (!(await isGhAuthenticated())) {
      throw new Error(
        "the github cli (gh) is not installed or not authenticated — run `gh auth login` first",
      );
    }
    const repo = (await ctx.get("repo")) ?? (await getConfiguredGithubRepo());
    if (!repo) {
      throw new Error(
        `no github repository found on the '${getPipelineGitRemote(config, "github")}' remote — pass it as owner/name or configure pipelines.github.gitRemote`,
      );
    }

    const { secrets, missing } = await collectSecretsFromVault(ctx);

    if (missing.length > 0) {
      ctx.log(
        `⚠️ ${missing.length} secrets are not set in the vault and will be skipped:`,
      );
      missing.forEach((name) => ctx.log(`  - ${name}`));
      ctx.log("");
    }
    if (secrets.length === 0) {
      ctx.log("no secrets to sync 🤷");
      return;
    }

    ctx.log(`about to set ${secrets.length} secrets on '${repo}':`);
    secrets.forEach(({ name }) => ctx.log(`  - ${name}`));
    ctx.log("");
    const confirmed = await ctx.confirm("continue? 🤔");
    if (!confirmed) {
      throw new Error("abort");
    }

    await pushSecretsToGithub(ctx, repo, secrets);
    ctx.log("");
    ctx.log(
      "done! 😻 the github pipeline can use them as ${{ secrets.<NAME> }}",
    );
  },
});
