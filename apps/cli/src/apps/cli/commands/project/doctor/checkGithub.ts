import type { Config } from "@catladder/pipeline";
import {
  getEnabledPipelineTypes,
  getPipelineGitRemote,
} from "@catladder/pipeline";
import {
  collectSecretTargets,
  getConfiguredGithubRepo,
} from "../../../../../commands/project/commandSecretsSyncGithub";
import { mapWithConcurrency } from "../../../../../utils/concurrency";
import {
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
};
