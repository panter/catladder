import { getRunnerImage } from "../../runner";
import type { WorkspaceContext } from "../../types/context";
import {
  componentContextIsStandaloneBuild,
  type ComponentContext,
} from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray, notNil } from "../../utils";
import { createArtifactsConfig } from "../base/createArtifactsConfig";
import { getNodeCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import { ensureNodeVersion, getYarnInstall } from "./yarn";

export const createNodeTestJobs = (
  context: ComponentContext | WorkspaceContext,
): CatladderJob[] => {
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
            ...(context.build.config.extraVars ?? {}),
          }
        : {}),
    },

    runnerVariables: NODE_RUNNER_BUILD_VARIABLES,
    stage: "test",
    needs: [],
    envMode: "none",
  };
  const buildConfig = context.build.config;
  const yarnInstall = getYarnInstall(context);
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
              context.packageManagerInfo.isClassic
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
          cache: getNodeCache(context),
          script: [
            ...ensureNodeVersion(context),
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
          cache: getNodeCache(context),
          script: [
            ...ensureNodeVersion(context),
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
