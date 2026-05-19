import { getRunnerImage } from "../../runner";
import type { WorkspaceContext } from "../../types/context";
import {
  componentContextIsStandaloneBuild,
  type ComponentContext,
} from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { ensureArrayOrNull, notNil } from "../../utils";
import { createArtifactsConfig } from "../base/createArtifactsConfig";
import { getNodeCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import { ensureNodeVersion, getYarnInstall } from "./yarn";
import { createJobCacheFromCacheConfigs } from "../cache/createJobCache";

export const createNodeTestJobs = async (
  context: ComponentContext | WorkspaceContext,
): Promise<CatladderJob[]> => {
  // don't run tests after release
  // TODO: this will be replaced by using rules
  if (context.trigger === "taggedRelease") {
    return [];
  }
  // if its not a standalone build, we don't need to run tests
  if (
    context.type === "component" &&
    !componentContextIsStandaloneBuild(context)
  ) {
    return [];
  }

  const defaultImage = getRunnerImage("jobs-default");
  const base: Omit<CatladderJob, "script" | "name"> = {
    variables: {
      APP_PATH: context.build.dir,
      ...(context.type === "component"
        ? {
            ...context.environment.jobOnlyVars.build.envVars,
          }
        : {}),
    },

    stage: "test",
    needs: [],
  };
  const buildConfig = context.build.config;
  const [yarnInstall, packageManagerInfo, nodeCache] = await Promise.all([
    getYarnInstall(context),
    context.packageManagerInfo,
    getNodeCache(context),
  ]);
  const auditJob: CatladderJob | null =
    buildConfig.audit !== false
      ? {
          name: "🛡 audit",
          ...base,
          runnerVariables: {
            ...NODE_RUNNER_BUILD_VARIABLES,
            ...(buildConfig.audit?.runnerVariables ?? {}),
          },
          image: buildConfig.audit?.jobImage ?? defaultImage,
          cache: undefined, // audit does not need yarn install and no cache
          script: [
            `cd ${context.build.dir}`,
            ...(ensureArrayOrNull(buildConfig.audit?.command) ?? [
              packageManagerInfo.isClassic
                ? "yarn audit --level critical"
                : "yarn npm audit --environment production --severity critical", // yarn 2
            ]),
          ],
          allow_failure: buildConfig.audit?.allowFailure ?? true,
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
          runnerVariables: {
            ...NODE_RUNNER_BUILD_VARIABLES,
            ...(buildConfig.lint?.runnerVariables ?? {}),
          },
          image: buildConfig.lint?.jobImage ?? defaultImage,
          cache: createJobCacheFromCacheConfigs(context, nodeCache),
          script: [
            ...ensureNodeVersion(context),
            `cd ${context.build.dir}`,
            ...yarnInstall,
            ...(ensureArrayOrNull(buildConfig.lint?.command) ?? ["yarn lint"]),
          ],
          allow_failure: buildConfig.lint?.allowFailure,
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
          runnerVariables: {
            ...NODE_RUNNER_BUILD_VARIABLES,
            ...(buildConfig.test?.runnerVariables ?? {}),
          },
          image:
            buildConfig.test?.jobImage ?? getRunnerImage("jobs-testing-chrome"),
          cache: createJobCacheFromCacheConfigs(context, nodeCache),
          script: [
            ...ensureNodeVersion(context),
            `cd ${context.build.dir}`,
            ...yarnInstall,
            ...(ensureArrayOrNull(buildConfig.test?.command) ?? ["yarn test"]),
          ],
          allow_failure: buildConfig.test?.allowFailure,
          ...createArtifactsConfig(
            context.build.dir,
            buildConfig.test?.artifactsReports,
            buildConfig.test?.artifacts,
          ),
        }
      : null;
  return [auditJob, lintJob, testJob].filter(notNil);
};
