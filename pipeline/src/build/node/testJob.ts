import { getRunnerImage } from "../../runner";
import type { ComponentContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray, notNil } from "../../utils";
import { getNodeCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import { ensureNodeVersion, getYarnInstall } from "./yarn";
import { createArtifactsConfig } from "../base/createArtifactsConfig";

export const createNodeTestJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  // don't run tests after release
  // TODO: this will be replaced by using rules
  if (context.trigger === "taggedRelease") {
    return [];
  }

  const buildConfig = context.build.config;

  const defaultImage = getRunnerImage("jobs-default");
  const base: Omit<CatladderJob, "script" | "name"> = {
    variables: {
      APP_PATH: context.build.dir,
      ...context.environment.jobOnlyVars.build.envVars,
      ...(buildConfig.extraVars ?? {}),
    },
    runnerVariables: NODE_RUNNER_BUILD_VARIABLES,
    stage: "test",
    needs: [],
    envMode: "none",
  };
  const yarnInstall = getYarnInstall(context.build);
  const auditJob: CatladderJob | null =
    buildConfig.audit !== false
      ? {
          name: "🛡 audit",
          ...base,
          image: buildConfig.audit?.jobImage ?? defaultImage,
          cache: undefined, // audit does not need yarn install and no cache
          script: [
            `cd ${context.build.dir}`,
            ...(ensureArray(buildConfig.audit?.command) ?? [
              context.build.packageManagerInfo.isClassic
                ? "yarn audit"
                : "yarn npm audit --environment production", // yarn 2
            ]),
          ],
          allow_failure: true,
          ...createArtifactsConfig(
            context.build.dir,
            buildConfig.audit?.artifactsReports,
            buildConfig.audit?.artifacts,
          ),
        }
      : null;

  const lintJob: CatladderJob | null =
    buildConfig.lint !== false
      ? {
          name: "👮 lint",
          ...base,
          image: buildConfig.lint?.jobImage ?? defaultImage,
          cache: getNodeCache(context.build),
          script: [
            ...ensureNodeVersion(context.build),
            `cd ${context.build.dir}`,
            ...yarnInstall,
            ...(ensureArray(buildConfig.lint?.command) ?? ["yarn lint"]),
          ],
          ...createArtifactsConfig(
            context.build.dir,
            buildConfig.lint?.artifactsReports,
            buildConfig.lint?.artifacts,
          ),
        }
      : null;
  const testJob: CatladderJob | null =
    buildConfig.test !== false
      ? {
          name: "🧪 test",

          ...base,
          image:
            buildConfig.test?.jobImage ?? getRunnerImage("jobs-testing-chrome"),
          cache: getNodeCache(context.build),
          script: [
            ...ensureNodeVersion(context.build),
            `cd ${context.build.dir}`,
            ...yarnInstall,
            ...(ensureArray(buildConfig.test?.command) ?? ["yarn test"]),
          ],
          ...createArtifactsConfig(
            context.build.dir,
            buildConfig.test?.artifactsReports,
            buildConfig.test?.artifacts,
          ),
        }
      : null;
  return [auditJob, lintJob, testJob].filter(notNil);
};
