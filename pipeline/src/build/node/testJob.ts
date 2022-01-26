import { BASE_RETRY } from "../../defaults";
import { Context } from "../../types/context";
import { GitlabJob, GitlabJobDef, GitlabJobs } from "../../types/gitlab-types";
import { ensureArray, notNil } from "../../utils";
import { getNodeCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import { getYarnInstall } from "./yarn";

export const createNodeTestJobs = (context: Context): GitlabJobs => {
  // don't run tests after release
  if (context.commitInfo?.trigger === "taggedRelease") {
    return [];
  }

  const buildConfig = context.componentConfig.build;

  const base: Omit<GitlabJobDef, "script"> = {
    variables: {
      APP_PATH: context.componentConfig.dir,
      ...NODE_RUNNER_BUILD_VARIABLES,
      ...(buildConfig.extraVars ?? {}),
    },

    stage: "test",
    interruptible: true,
    needs: [],
    retry: BASE_RETRY,
  };
  const yarnInstall = getYarnInstall(context);
  const auditJob: GitlabJob | null =
    buildConfig.audit !== false
      ? {
          name: "🛡 audit",
          envMode: "none",
          job: {
            ...base,
            cache: undefined, // audit does not need yarn install and no cache
            script: [
              `cd ${context.componentConfig.dir}`,
              ...(ensureArray(buildConfig.audit?.command) ?? ["yarn audit"]),
            ],
            allow_failure: true,
          },
        }
      : null;

  const lintJob: GitlabJob | null =
    buildConfig.lint !== false
      ? {
          name: "👮 lint",
          envMode: "none",
          job: {
            ...base,
            cache: getNodeCache(context),
            script: [
              `cd ${context.componentConfig.dir}`,
              ...yarnInstall,
              ...(ensureArray(buildConfig.lint?.command) ?? ["yarn lint"]),
            ],
          },
        }
      : null;
  const testJob: GitlabJob | null =
    buildConfig.test !== false
      ? {
          name: "🧪 test",
          envMode: "none",
          job: {
            ...base,
            cache: getNodeCache(context),
            script: [
              `cd ${context.componentConfig.dir}`,
              ...yarnInstall,
              ...(ensureArray(buildConfig.test?.command) ?? ["yarn test"]),
            ],
          },
        }
      : null;
  return [auditJob, lintJob, testJob].filter(notNil);
};
