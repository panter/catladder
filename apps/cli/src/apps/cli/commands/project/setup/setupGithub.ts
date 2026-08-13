import type { Config } from "@catladder/pipeline";
import {
  AGGREGATE_CHECK_JOB_NAME,
  getEnabledPipelineTypes,
  getPipelineGitRemote,
} from "@catladder/pipeline";
import { execFile as execFileCb } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { getConfiguredGithubRepo } from "../../../../../commands/project/commandSecretsSyncGithub";
import type { IO } from "../../../../../core/types";
import {
  ghApiJson,
  isGhAuthenticated,
  listGithubSecretNames,
  setGithubSecret,
} from "../../../../../utils/github";
import type { GithubRuleset } from "../githubMergeGating";
import {
  desiredMergeGatingRuleset,
  MERGE_GATING_RULESET_NAME,
  RELEASE_DEPLOY_KEY_SECRET,
  RELEASE_DEPLOY_KEY_TITLE,
  rulesetProvidesMergeGating,
} from "../githubMergeGating";

const execFile = promisify(execFileCb);

/**
 * configures github merge gating — the sane default gitlab ships
 * built-in and a fresh github repository lacks entirely: without it a
 * PR is mergeable the moment it opens, checks still running, and the
 * auto-merge button never appears.
 *
 * - repo settings: allow auto-merge, delete merged head branches
 * - the release deploy key: a write deploy key on the repo, its
 *   private half stored as the CATLADDER_RELEASE_KEY actions secret —
 *   the release job pushes the release commit and tag with it
 * - a repository ruleset on the default branch requiring the generated
 *   `catladder ✅` aggregate check (the one stable context — individual
 *   job names change with every component add/rename), with a deploy
 *   key bypass so the release push goes through (see
 *   githubMergeGating.ts for the full rationale)
 *
 * Earlier versions required the check via classic branch protection,
 * which has no bypass list — the release job's direct push to the
 * default branch bounced off catladder's own gating (GH006). Setup
 * migrates that away: the aggregate context is removed from an
 * existing classic rule, everything else in it is preserved.
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

  await ensureReleaseDeployKey(instance, repo);

  const branch = repoInfo.default_branch;
  const rulesets = await ghApiJson<Array<{ id: number; name: string }>>(
    "GET",
    `repos/${repo}/rulesets?per_page=100`,
  );
  const existing = rulesets.find((r) => r.name === MERGE_GATING_RULESET_NAME);
  if (!existing) {
    await ghApiJson(
      "POST",
      `repos/${repo}/rulesets`,
      desiredMergeGatingRuleset(),
    );
    instance.log(
      `✅ ruleset '${MERGE_GATING_RULESET_NAME}': '${AGGREGATE_CHECK_JOB_NAME}' required on ${branch} — merges wait for the pipeline, the release job can push`,
    );
  } else {
    const detail = await ghApiJson<GithubRuleset>(
      "GET",
      `repos/${repo}/rulesets/${existing.id}`,
    );
    if (rulesetProvidesMergeGating(detail)) {
      instance.log(
        `✅ ruleset '${MERGE_GATING_RULESET_NAME}' already in place on ${branch}`,
      );
    } else {
      await ghApiJson(
        "PUT",
        `repos/${repo}/rulesets/${existing.id}`,
        desiredMergeGatingRuleset(),
      );
      instance.log(
        `✅ ruleset '${MERGE_GATING_RULESET_NAME}' restored — '${AGGREGATE_CHECK_JOB_NAME}' required, release-job bypass in place`,
      );
    }
  }

  await migrateAwayFromClassicProtection(instance, repo, branch);
};

/**
 * provisions the release deploy key: an ed25519 keypair whose public
 * half becomes a write deploy key on the repo and whose private half
 * becomes the CATLADDER_RELEASE_KEY actions secret. The key and the
 * secret only work as a pair, so when either half is missing the pair
 * is rotated (github secrets are write-only — the private half can
 * never be read back to check it matches).
 */
const ensureReleaseDeployKey = async (instance: IO, repo: string) => {
  const [keys, secretNames] = await Promise.all([
    ghApiJson<Array<{ id: number; title: string; read_only: boolean }>>(
      "GET",
      `repos/${repo}/keys?per_page=100`,
    ),
    listGithubSecretNames(repo),
  ]);
  const existingKey = keys.find((k) => k.title === RELEASE_DEPLOY_KEY_TITLE);
  const hasSecret = secretNames.some(
    (name) => name.toUpperCase() === RELEASE_DEPLOY_KEY_SECRET,
  );
  if (existingKey && !existingKey.read_only && hasSecret) {
    instance.log(
      `✅ release deploy key '${RELEASE_DEPLOY_KEY_TITLE}' + secret ${RELEASE_DEPLOY_KEY_SECRET} in place`,
    );
    return;
  }
  if (existingKey) {
    await ghApiJson("DELETE", `repos/${repo}/keys/${existingKey.id}`);
    instance.log(
      `♻️ release deploy key '${RELEASE_DEPLOY_KEY_TITLE}' rotated (${
        existingKey.read_only
          ? "was read-only"
          : `secret ${RELEASE_DEPLOY_KEY_SECRET} missing`
      })`,
    );
  }

  const dir = await mkdtemp(join(tmpdir(), "catladder-release-key-"));
  try {
    const keyFile = join(dir, "id_ed25519");
    await execFile("ssh-keygen", [
      ...["-t", "ed25519"],
      ...["-C", `${RELEASE_DEPLOY_KEY_TITLE} (${repo})`],
      ...["-N", ""],
      ...["-f", keyFile],
      "-q",
    ]);
    const [privateKey, publicKey] = await Promise.all([
      readFile(keyFile, "utf-8"),
      readFile(`${keyFile}.pub`, "utf-8"),
    ]);
    await ghApiJson("POST", `repos/${repo}/keys`, {
      title: RELEASE_DEPLOY_KEY_TITLE,
      key: publicKey.trim(),
      read_only: false,
    });
    await setGithubSecret(repo, RELEASE_DEPLOY_KEY_SECRET, privateKey);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  instance.log(
    `✅ release deploy key '${RELEASE_DEPLOY_KEY_TITLE}' registered, private half stored as secret ${RELEASE_DEPLOY_KEY_SECRET} — the release job pushes with it`,
  );
};

/**
 * removes the aggregate check from a classic branch protection rule
 * set up by earlier catladder versions — with the check now required
 * via the ruleset, the classic one would still reject the release
 * job's push. Everything else in the rule is preserved; the whole rule
 * is deleted when the check was all it carried.
 */
const migrateAwayFromClassicProtection = async (
  instance: IO,
  repo: string,
  branch: string,
) => {
  const protection = await ghApiJson<any>(
    "GET",
    `repos/${repo}/branches/${branch}/protection`,
  ).catch(() => null); // 404: branch not protected
  const checks: Array<{ context: string; app_id?: number }> =
    protection?.required_status_checks?.checks ?? [];
  if (!checks.some((c) => c.context === AGGREGATE_CHECK_JOB_NAME)) {
    return;
  }
  const remaining = checks.filter(
    (c) => c.context !== AGGREGATE_CHECK_JOB_NAME,
  );
  const carriesAnythingElse =
    remaining.length > 0 ||
    protection?.enforce_admins?.enabled ||
    protection?.required_pull_request_reviews ||
    protection?.restrictions ||
    protection?.required_linear_history?.enabled ||
    protection?.required_conversation_resolution?.enabled ||
    protection?.required_signatures?.enabled ||
    protection?.lock_branch?.enabled ||
    protection?.allow_force_pushes?.enabled ||
    protection?.allow_deletions?.enabled;
  if (!carriesAnythingElse) {
    await ghApiJson("DELETE", `repos/${repo}/branches/${branch}/protection`);
    instance.log(
      `✅ classic branch protection on ${branch} removed — '${AGGREGATE_CHECK_JOB_NAME}' was all it carried, and it is now required via the ruleset`,
    );
    return;
  }
  // PUT replaces the whole rule, so every preserved setting must be
  // carried over explicitly
  await ghApiJson("PUT", `repos/${repo}/branches/${branch}/protection`, {
    required_status_checks:
      remaining.length > 0
        ? {
            strict: protection?.required_status_checks?.strict ?? false,
            checks: remaining.map(({ context, app_id }) => ({
              context,
              ...(app_id !== undefined ? { app_id } : {}),
            })),
          }
        : null,
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
    required_linear_history:
      protection?.required_linear_history?.enabled ?? false,
    required_conversation_resolution:
      protection?.required_conversation_resolution?.enabled ?? false,
    lock_branch: protection?.lock_branch?.enabled ?? false,
    allow_force_pushes: protection?.allow_force_pushes?.enabled ?? false,
    allow_deletions: protection?.allow_deletions?.enabled ?? false,
  });
  instance.log(
    `✅ '${AGGREGATE_CHECK_JOB_NAME}' removed from classic branch protection on ${branch} — now required via the ruleset; the rest of the rule is preserved`,
  );
};
