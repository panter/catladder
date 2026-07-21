import { createArtifactsConfig } from "../build/base/createArtifactsConfig";
import { getNodeCache } from "../build/node/cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "../build/node/constants";
import { ensureNodeVersion, getYarnInstall } from "../build/node/yarn";
import { DEPLOY_TYPES } from "../deploy";
import { getRunnerImage } from "../runner";
import type { ComponentContext } from "../types/context";
import type { CatladderJob } from "../types/jobs";
import { ensureArray } from "../utils";

export const VERIFY_JOB_NAME = "🔍 verify";

export const createVerifyJobs = async (
  context: ComponentContext,
): Promise<CatladderJob[]> => {
  const verifyConfig = context.componentConfig.verify;
  if (!verifyConfig) {
    return [];
  }

  const deployConfig = context.deploy?.config;
  if (!deployConfig) {
    // nothing is deployed, so there is nothing to verify
    return [];
  }

  const isNodeBuild =
    context.build.type !== "disabled" && context.build.buildType === "node";

  const [yarnInstall, nodeCache] = isNodeBuild
    ? await Promise.all([
        getYarnInstall(context),
        getNodeCache(context, "pull"),
      ])
    : [null, null];

  const setupScript =
    DEPLOY_TYPES[deployConfig.type].verifyJobSetupScript?.(context) ?? [];

  return [
    {
      name: VERIFY_JOB_NAME,
      stage: "verify",
      envMode: "stagePerEnv",
      requires: [
        // wait for this component's own deploy
        { capability: "deployment", artifacts: false },
        // ...and for the deploys of the components listed in waitFor
        ...(verifyConfig.waitFor ?? []).map((componentName) => ({
          capability: "deployment" as const,
          from: { component: componentName },
          artifacts: false,
          strict: true,
        })),
      ],
      image: verifyConfig.jobImage ?? getRunnerImage("jobs-testing-chrome"),
      // neutral cache declarations — each backend lowers them itself
      // (gitlab strips the github-only hint keys, github builds cache
      // restore steps). Pre-lowering via createJobCacheFromCacheConfigs
      // would leak the hints into the gitlab yaml, which rejects them.
      caches: nodeCache ?? undefined,
      variables: {
        ...context.environment.envVars,
      },
      runnerVariables: {
        ...NODE_RUNNER_BUILD_VARIABLES,
        ...(verifyConfig.runnerVariables ?? {}),
      },
      script: [
        ...setupScript,
        ...(yarnInstall ? ensureNodeVersion(context) : []),
        `cd ${context.build.dir}`,
        ...(yarnInstall ?? []),
        ...ensureArray(verifyConfig.command),
      ],
      allow_failure: verifyConfig.allowFailure,
      ...createArtifactsConfig(
        context.build.dir,
        verifyConfig.artifactsReports,
        verifyConfig.artifacts,
      ),
    },
  ];
};
