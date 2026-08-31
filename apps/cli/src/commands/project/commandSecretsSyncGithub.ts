import {
  getEnabledPipelineTypes,
  getPipelineGitRemote,
} from "@catladder/pipeline";
import { getProjectConfig } from "../../config/getProjectConfig";
import { defineCommand } from "../../core/defineCommand";
import {
  collectSecretsFromVault,
  collectSecretTargets,
  getConfiguredGithubRepo,
  pushSecretsToGithub,
} from "../../secrets";
import { isGhAuthenticated } from "../../utils/github";

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
    env: {
      type: "string",
      message:
        "only sync these environments (comma-separated, e.g. review,dev) — github allows at most 100 repo secrets",
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

    const envFilter = (await ctx.get("env"))?.split(",").map((e) => e.trim());
    const { secrets, missing } = await collectSecretsFromVault(ctx, envFilter);

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

    await pushSecretsToGithub(
      ctx,
      repo,
      secrets,
      await collectSecretTargets(config),
    );
    ctx.log("");
    ctx.log(
      "done! 😻 the github pipeline can use them as ${{ secrets.<NAME> }}",
    );
  },
});
