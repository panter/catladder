import { getRunnerImage } from "../../runner";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray, notNil } from "../../utils";
import { getNodeCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import { getYarnInstall } from "./yarn";

export const createNodeTestJobs = (context: Context): CatladderJob[] => {
  // don't run tests after release
  if (context.commitInfo?.trigger === "taggedRelease") {
    return [];
  }

  const buildConfig = context.componentConfig.build;
  const defaultImage = getRunnerImage("jobs-default");
  const base: Omit<CatladderJob, "script" | "name"> = {
    variables: {
      APP_PATH: context.componentConfig.dir,
      ...NODE_RUNNER_BUILD_VARIABLES,
      ...context.environment.jobOnlyVars.build.envVars,
      ...(buildConfig.extraVars ?? {}),
    },
    stage: "test",
    needs: [],
    envMode: "none",
  };
  const yarnInstall = getYarnInstall(context);
  const auditJob: CatladderJob | null =
    buildConfig.audit !== false
      ? {
          name: "🛡 audit",
          ...base,
          image: buildConfig.audit?.jobImage ?? defaultImage,
          cache: undefined, // audit does not need yarn install and no cache
          script: [
            `cd ${context.componentConfig.dir}`,
            ...(ensureArray(buildConfig.audit?.command) ?? [
              context.packageManagerInfo?.isClassic
                ? "yarn audit"
                : "yarn npm audit --environment production", // yarn 2
            ]),
          ],
          allow_failure: true,
        }
      : null;

  const lintJob: CatladderJob | null =
    buildConfig.lint !== false
      ? {
          name: "👮 lint",
          ...base,
          image: buildConfig.lint?.jobImage ?? defaultImage,
          cache: getNodeCache(context),
          script: [
            `cd ${context.componentConfig.dir}`,
            ...yarnInstall,
            ...(ensureArray(buildConfig.lint?.command) ?? ["yarn lint"]),
          ],
        }
      : null;
  const testJob: CatladderJob | null =
    buildConfig.test !== false
      ? {
          name: "🧪 test",

          ...base,
          image:
            buildConfig.test?.jobImage ?? getRunnerImage("jobs-testing-chrome"),
          cache: getNodeCache(context),
          script: [
            `cd ${context.componentConfig.dir}`,
            ...yarnInstall,
            ...(ensureArray(buildConfig.test?.command) ?? ["yarn test"]),
          ],
        }
      : null;
  return [auditJob, lintJob, testJob].filter(notNil);
};
