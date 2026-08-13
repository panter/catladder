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
 * enabled and the generated `catladder ✅` aggregate check required on
 * the default branch. Without it a PR is mergeable while its checks
 * are still running — gitlab ships this behavior built-in, github
 * silently does not.
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
  const protection = await ghApiJson<any>(
    "GET",
    `repos/${repo}/branches/${branch}/protection`,
  ).catch(() => null);
  const checks: Array<{ context: string }> =
    protection?.required_status_checks?.checks ?? [];
  if (checks.some((c) => c.context === AGGREGATE_CHECK_JOB_NAME)) {
    report.ok(`'${AGGREGATE_CHECK_JOB_NAME}' required on ${branch}`);
  } else {
    report.fail(
      `'${AGGREGATE_CHECK_JOB_NAME}' is not a required check on ${branch} — PRs can merge while the pipeline is red or still running`,
      "run: catladder project setup",
    );
  }
  const stale = checks.filter((c) => c.context !== AGGREGATE_CHECK_JOB_NAME);
  if (stale.length > 0) {
    report.warn(
      `${branch} requires ${stale.length} additional named check(s) (${stale
        .map((c) => c.context)
        .join(
          ", ",
        )}) — job names change with components; prefer only '${AGGREGATE_CHECK_JOB_NAME}'`,
    );
  }
};
