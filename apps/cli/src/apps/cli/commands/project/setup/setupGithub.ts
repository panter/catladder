import type { Config } from "@catladder/pipeline";
import {
  AGGREGATE_CHECK_JOB_NAME,
  getEnabledPipelineTypes,
  getPipelineGitRemote,
} from "@catladder/pipeline";
import { getConfiguredGithubRepo } from "../../../../../commands/project/commandSecretsSyncGithub";
import type { IO } from "../../../../../core/types";
import { ghApiJson, isGhAuthenticated } from "../../../../../utils/github";

/**
 * configures github merge gating — the sane default gitlab ships
 * built-in and a fresh github repository lacks entirely: without it a
 * PR is mergeable the moment it opens, checks still running, and the
 * auto-merge button never appears.
 *
 * - repo settings: allow auto-merge, delete merged head branches
 * - branch protection on the default branch: require the generated
 *   `catladder ✅` aggregate check (the one stable context — individual
 *   job names change with every component add/rename)
 *
 * Deliberately non-destructive: existing protection settings
 * (enforce-admins, required reviews, restrictions, strictness) are
 * preserved; the aggregate context is merged into the required checks
 * rather than replacing them. Admins can still bypass per PR — this is
 * a default, not a cage.
 */
export const setupGithub = async (instance: IO, config: Config) => {
  if (!getEnabledPipelineTypes(config).includes("github")) {
    return;
  }
  if (!(await isGhAuthenticated())) {
    instance.log(
      "⚠️ github cli (gh) not authenticated — skipping github merge-gating setup (run: gh auth login)",
    );
    return;
  }
  const repo = await getConfiguredGithubRepo();
  if (!repo) {
    instance.log(
      `⚠️ no github repository found on the '${getPipelineGitRemote(config, "github")}' remote — skipping github merge-gating setup`,
    );
    return;
  }

  const repoInfo = await ghApiJson<{
    default_branch: string;
    allow_auto_merge: boolean;
    delete_branch_on_merge: boolean;
  }>("GET", `repos/${repo}`);

  if (!repoInfo.allow_auto_merge || !repoInfo.delete_branch_on_merge) {
    await ghApiJson("PATCH", `repos/${repo}`, {
      allow_auto_merge: true,
      delete_branch_on_merge: true,
    });
    instance.log("✅ auto-merge + delete-merged-branches enabled");
  } else {
    instance.log("✅ auto-merge already enabled");
  }

  const branch = repoInfo.default_branch;
  const protection = await ghApiJson<any>(
    "GET",
    `repos/${repo}/branches/${branch}/protection`,
  ).catch(() => null); // 404: branch not protected yet

  const existingChecks: Array<{ context: string; app_id?: number }> =
    protection?.required_status_checks?.checks ?? [];
  if (existingChecks.some((c) => c.context === AGGREGATE_CHECK_JOB_NAME)) {
    instance.log(
      `✅ '${AGGREGATE_CHECK_JOB_NAME}' already required on ${branch}`,
    );
    return;
  }

  // merge into whatever protection exists; PUT replaces the whole rule,
  // so every preserved setting must be carried over explicitly
  await ghApiJson("PUT", `repos/${repo}/branches/${branch}/protection`, {
    required_status_checks: {
      strict: protection?.required_status_checks?.strict ?? false,
      checks: [
        ...existingChecks.map(({ context, app_id }) => ({
          context,
          ...(app_id !== undefined ? { app_id } : {}),
        })),
        { context: AGGREGATE_CHECK_JOB_NAME },
      ],
    },
    enforce_admins: protection?.enforce_admins?.enabled ?? false,
    required_pull_request_reviews: protection?.required_pull_request_reviews
      ? {
          required_approving_review_count:
            protection.required_pull_request_reviews
              .required_approving_review_count ?? 0,
          dismiss_stale_reviews:
            protection.required_pull_request_reviews.dismiss_stale_reviews ??
            false,
          require_code_owner_reviews:
            protection.required_pull_request_reviews
              .require_code_owner_reviews ?? false,
        }
      : null,
    restrictions: protection?.restrictions
      ? {
          users: protection.restrictions.users.map((u: any) => u.login),
          teams: protection.restrictions.teams.map((t: any) => t.slug),
          apps: protection.restrictions.apps.map((a: any) => a.slug),
        }
      : null,
    allow_force_pushes: protection?.allow_force_pushes?.enabled ?? false,
    allow_deletions: protection?.allow_deletions?.enabled ?? false,
  });
  instance.log(
    `✅ branch protection on ${branch}: '${AGGREGATE_CHECK_JOB_NAME}' required (merges now wait for the pipeline)`,
  );
};
