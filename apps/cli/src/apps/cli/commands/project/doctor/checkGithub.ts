import type { Config } from "@catladder/pipeline";
import {
  AGGREGATE_CHECK_JOB_NAME,
  getEnabledPipelineTypes,
  getPipelineGitRemote,
} from "@catladder/pipeline";
import {
  collectSecretTargets,
  getConfiguredGithubRepo,
} from "../../../../../commands/project/commandSecretsSyncGithub";
import { mapWithConcurrency } from "../../../../../utils/concurrency";
import {
  ghApiJson,
  isGhAuthenticated,
  listGithubEnvironments,
  listGithubSecretNames,
  listGithubVariableNames,
} from "../../../../../utils/github";
import type { GithubRuleset } from "../githubMergeGating";
import {
  MERGE_GATING_RULESET_NAME,
  RELEASE_DEPLOY_KEY_SECRET,
  RELEASE_DEPLOY_KEY_TITLE,
  rulesetProvidesMergeGating,
} from "../githubMergeGating";
import type { DoctorReport } from "./DoctorReport";

/** marker for repo-level (environment-less) targets, see collectSecretTargets */
const REPO_LEVEL = "";

/**
 * compares the secret/variable NAMES the generated github workflows
 * reference against what is actually set — per github environment, the
 * same mapping `project secrets-sync-github` writes. Values cannot be
 * compared: github secrets are write-only by design (the vault stays
 * the source of truth).
 */
export const checkGithub = async (report: DoctorReport, config: Config) => {
  if (!getEnabledPipelineTypes(config).includes("github")) return;
  report.section("github environments & secrets");

  if (!(await isGhAuthenticated())) {
    report.warn(
      "github cli (gh) not authenticated — github checks skipped",
      "run: gh auth login",
    );
    return;
  }
  const repo = await getConfiguredGithubRepo();
  if (!repo) {
    report.fail(
      `no github repository found on the '${getPipelineGitRemote(config, "github")}' remote`,
    );
    return;
  }

  let targets: Map<string, Set<string>>;
  try {
    targets = await collectSecretTargets(config);
  } catch (e) {
    report.warn(
      `could not generate the github workflows to derive secret references (${e.message})`,
    );
    return;
  }

  const referencedNamesOf = (environment: string) =>
    [...targets.entries()]
      .filter(([, envs]) => envs.has(environment))
      .map(([name]) => name);

  const environmentsNeeded = [
    ...new Set([...targets.values()].flatMap((envs) => [...envs])),
  ]
    .filter((environment) => environment !== REPO_LEVEL)
    .sort();

  let existingEnvironments: Set<string>;
  try {
    existingEnvironments = new Set(await listGithubEnvironments(repo));
  } catch (e) {
    report.warn(`could not list environments of ${repo} (${e.message})`);
    return;
  }

  const perEnvironment = await mapWithConcurrency(
    environmentsNeeded,
    8,
    async (environment) => {
      const referenced = referencedNamesOf(environment);
      if (!existingEnvironments.has(environment)) {
        return { environment, referenced, exists: false as const };
      }
      const [secrets, variables] = await Promise.all([
        listGithubSecretNames(repo, environment),
        listGithubVariableNames(repo, environment),
      ]);
      // github secret names are case-insensitive and the api returns
      // them uppercased — compare accordingly
      const present = new Set(
        [...secrets, ...variables].map((name) => name.toUpperCase()),
      );
      const referencedUpper = new Set(
        referenced.map((name) => name.toUpperCase()),
      );
      return {
        environment,
        referenced,
        exists: true as const,
        missing: referenced.filter((name) => !present.has(name.toUpperCase())),
        stale: [...present].filter((name) => !referencedUpper.has(name)),
      };
    },
  );

  for (const result of perEnvironment) {
    const { environment, referenced } = result;
    if (!result.exists) {
      report.fail(
        `environment '${environment}' does not exist (${referenced.length} referenced secrets have nowhere to live)`,
        "run: catladder project secrets-sync-github",
      );
      continue;
    }
    if (result.missing.length > 0) {
      report.fail(
        `${environment}: missing ${result.missing.length}/${referenced.length} referenced secrets: ${result.missing.join(", ")}`,
        "run: catladder project secrets-sync-github",
      );
    } else {
      report.ok(
        `${environment}: all ${referenced.length} referenced secrets/variables present`,
      );
    }
    if (result.stale.length > 0) {
      report.warn(
        `${environment}: ${result.stale.length} set but not referenced by any workflow (stale?): ${result.stale.join(", ")}`,
      );
    }
  }

  const repoLevelReferenced = referencedNamesOf(REPO_LEVEL);
  if (repoLevelReferenced.length > 0) {
    const [secrets, variables] = await Promise.all([
      listGithubSecretNames(repo),
      listGithubVariableNames(repo),
    ]);
    const present = new Set(
      [...secrets, ...variables].map((name) => name.toUpperCase()),
    );
    const missing = repoLevelReferenced.filter(
      (name) => !present.has(name.toUpperCase()),
    );
    if (missing.length > 0) {
      report.fail(
        `repo level: missing ${missing.length}/${repoLevelReferenced.length} referenced secrets: ${missing.join(", ")}`,
        "run: catladder project secrets-sync-github",
      );
    } else {
      report.ok(
        `repo level: all ${repoLevelReferenced.length} referenced secrets/variables present`,
      );
    }
  }

  await checkGithubMergeGating(report, repo);
};

/**
 * verifies the merge gating `project setup` configures: auto-merge
 * enabled and the `catladder merge gating` ruleset requiring the
 * generated `catladder ✅` aggregate check on the default branch (with
 * the bypass that lets the release job push). Without the check a PR
 * is mergeable while its checks are still running — gitlab ships this
 * behavior built-in, github silently does not. The check required via
 * classic branch protection instead is flagged: that setup rejects the
 * release job's own push (GH006).
 */
const checkGithubMergeGating = async (report: DoctorReport, repo: string) => {
  let repoInfo: { default_branch: string; allow_auto_merge: boolean };
  try {
    repoInfo = await ghApiJson("GET", `repos/${repo}`);
  } catch (e) {
    report.warn(`could not read repo settings of ${repo} (${e.message})`);
    return;
  }
  if (repoInfo.allow_auto_merge) {
    report.ok("auto-merge enabled");
  } else {
    report.fail(
      "auto-merge disabled — the merge-when-pipeline-succeeds button cannot appear",
      "run: catladder project setup",
    );
  }

  const branch = repoInfo.default_branch;
  let rulesets: Array<{ id: number; name: string }>;
  try {
    rulesets = await ghApiJson("GET", `repos/${repo}/rulesets?per_page=100`);
  } catch (e) {
    report.warn(`could not list rulesets of ${repo} (${e.message})`);
    return;
  }
  const named = rulesets.find((r) => r.name === MERGE_GATING_RULESET_NAME);
  const ruleset = named
    ? await ghApiJson<GithubRuleset>(
        "GET",
        `repos/${repo}/rulesets/${named.id}`,
      ).catch(() => null)
    : null;
  if (ruleset && rulesetProvidesMergeGating(ruleset)) {
    report.ok(
      `ruleset '${MERGE_GATING_RULESET_NAME}': '${AGGREGATE_CHECK_JOB_NAME}' required on ${branch}, deploy-key bypass for the release push`,
    );
  } else if (ruleset) {
    report.fail(
      `ruleset '${MERGE_GATING_RULESET_NAME}' exists but is incomplete (inactive, check not required, or deploy-key bypass missing)`,
      "run: catladder project setup",
    );
  } else {
    report.fail(
      `no '${MERGE_GATING_RULESET_NAME}' ruleset on ${repo} — PRs can merge while the pipeline is red or still running`,
      "run: catladder project setup",
    );
  }

  try {
    const [keys, secretNames] = await Promise.all([
      ghApiJson<Array<{ title: string; read_only: boolean }>>(
        "GET",
        `repos/${repo}/keys?per_page=100`,
      ),
      listGithubSecretNames(repo),
    ]);
    const key = keys.find((k) => k.title === RELEASE_DEPLOY_KEY_TITLE);
    const hasSecret = secretNames.some(
      (name) => name.toUpperCase() === RELEASE_DEPLOY_KEY_SECRET,
    );
    if (key && !key.read_only && hasSecret) {
      report.ok(
        `release deploy key '${RELEASE_DEPLOY_KEY_TITLE}' + secret ${RELEASE_DEPLOY_KEY_SECRET} in place`,
      );
    } else {
      report.fail(
        `release deploy key incomplete (key: ${
          key ? (key.read_only ? "read-only" : "ok") : "missing"
        }, secret ${RELEASE_DEPLOY_KEY_SECRET}: ${hasSecret ? "set" : "missing"}) — the release job cannot push past the merge gating`,
        "run: catladder project setup",
      );
    }
  } catch (e) {
    report.warn(`could not check the release deploy key (${e.message})`);
  }

  const protection = await ghApiJson<any>(
    "GET",
    `repos/${repo}/branches/${branch}/protection`,
  ).catch(() => null);
  const checks: Array<{ context: string }> =
    protection?.required_status_checks?.checks ?? [];
  if (checks.some((c) => c.context === AGGREGATE_CHECK_JOB_NAME)) {
    report.fail(
      `'${AGGREGATE_CHECK_JOB_NAME}' is still required via classic branch protection on ${branch} — that rejects the release job's push (GH006)`,
      "run: catladder project setup",
    );
  }
  const stale = checks.filter((c) => c.context !== AGGREGATE_CHECK_JOB_NAME);
  if (stale.length > 0) {
    report.warn(
      `${branch} requires ${stale.length} additional named check(s) via classic branch protection (${stale
        .map((c) => c.context)
        .join(
          ", ",
        )}) — job names change with components; prefer only '${AGGREGATE_CHECK_JOB_NAME}'`,
    );
  }
};
