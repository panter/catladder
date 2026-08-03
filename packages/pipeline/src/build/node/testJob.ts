import { getRunnerImage } from "../../runner";
import type { WorkspaceContext } from "../../types/context";
import {
  componentContextIsStandaloneBuild,
  type ComponentContext,
} from "../../types/context";
import type { CatladderJobSpec } from "../../types/jobs";
import { CatladderJob } from "../../types/jobs";
import { ensureArrayOrNull, notNil } from "../../utils";
import { createArtifactsConfig } from "../base/createArtifactsConfig";
import { runScript } from "../runScript";
import { getNodeCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import {
  ensureNodeVersion,
  getDefaultAuditCommand,
  getPackageManagerInstall,
} from "./packageManagerInstall";

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
  const base: Omit<CatladderJobSpec, "script" | "name"> = {
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
  const [packageManagerInstall, packageManagerInfo, nodeCache] =
    await Promise.all([
      getPackageManagerInstall(context),
      context.packageManagerInfo,
      // pull-only: the build job is the designated cache writer — lint and
      // test produce equivalent content from the same lockfile, so their
      // uploads were pure redundancy (same multi-GB archive, last wins)
      getNodeCache(context, "pull"),
    ]);
  const auditJob: CatladderJob | null =
    buildConfig.audit !== false
      ? new CatladderJob({
          name: "🛡 audit",
          ...base,
          runnerVariables: {
            ...NODE_RUNNER_BUILD_VARIABLES,
            ...(buildConfig.audit?.runnerVariables ?? {}),
          },
          image: buildConfig.audit?.jobImage ?? defaultImage,
          caches: undefined, // audit does not need an install and no cache
          script: [
            `cd ${context.build.dir}`,
            ...(ensureArrayOrNull(buildConfig.audit?.command) ?? [
              getDefaultAuditCommand(packageManagerInfo),
            ]),
          ],
          allow_failure: buildConfig.audit?.allowFailure ?? true,
          ...createArtifactsConfig(
            context.build.dir,
            buildConfig.audit?.artifactsReports,
            buildConfig.audit?.artifacts,
          ),
        })
      : null;
  const lintJob: CatladderJob | null =
    buildConfig.lint !== false
      ? new CatladderJob({
          name: "👮 lint",
          ...base,
          runnerVariables: {
            ...NODE_RUNNER_BUILD_VARIABLES,
            ...(buildConfig.lint?.runnerVariables ?? {}),
          },
          image: buildConfig.lint?.jobImage ?? defaultImage,
          caches: nodeCache,
          script: [
            ...ensureNodeVersion(context),
            `cd ${context.build.dir}`,
            ...packageManagerInstall,
            ...(ensureArrayOrNull(buildConfig.lint?.command) ?? [
              runScript(packageManagerInfo.type, "lint"),
            ]),
          ],
          allow_failure: buildConfig.lint?.allowFailure,
          ...createArtifactsConfig(
            context.build.dir,
            buildConfig.lint?.artifactsReports,
            buildConfig.lint?.artifacts,
          ),
        })
      : null;
  const testJob: CatladderJob | null =
    buildConfig.test !== false
      ? new CatladderJob({
          name: "🧪 test",

          ...base,
          runnerVariables: {
            ...NODE_RUNNER_BUILD_VARIABLES,
            ...(buildConfig.test?.runnerVariables ?? {}),
          },
          // browser tests need a jobImage carrying the browser, e.g. the
          // official playwright image (version-matched to the project)
          image: buildConfig.test?.jobImage ?? getRunnerImage("jobs-default"),
          caches: nodeCache,
          script: [
            ...ensureNodeVersion(context),
            `cd ${context.build.dir}`,
            ...packageManagerInstall,
            ...(ensureArrayOrNull(buildConfig.test?.command) ?? [
              runScript(packageManagerInfo.type, "test"),
            ]),
          ],
          allow_failure: buildConfig.test?.allowFailure,
          ...createArtifactsConfig(
            context.build.dir,
            buildConfig.test?.artifactsReports,
            buildConfig.test?.artifacts,
          ),
        })
      : null;
  return [auditJob, lintJob, testJob].filter(notNil);
};
