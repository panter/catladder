import type { Artifacts } from "../../types";
import type { ComponentContextWithBuild } from "../../types/context";
import type { CatladderJobSpec } from "../../types/jobs";
import { CatladderJob } from "../../types/jobs";
import { ensureArray, notNil } from "../../utils";
import { createArtifactsConfig } from "../base/createArtifactsConfig";
import { createJobCacheFromConfig } from "../cache/createJobCache";
import { isOfBuildType } from "../types";

const RUNNER_CUSTOM_TEST_VARIABLES = {
  KUBERNETES_CPU_REQUEST: "0.45",
  KUBERNETES_MEMORY_REQUEST: "1Gi",
  KUBERNETES_MEMORY_LIMIT: "4Gi",
};

export const createCustomTestJobs = (
  context: ComponentContextWithBuild,
): CatladderJob[] => {
  // don't run tests after release
  // TODO: this will be replaced by using rules
  if (context.trigger === "taggedRelease") {
    return [];
  }

  const buildConfig = context.build.config;

  if (!isOfBuildType(buildConfig, "custom")) {
    throw new Error("deploy config is not custom");
  }

  const base: Omit<CatladderJobSpec, "script" | "name"> = {
    variables: {
      APP_PATH: context.build.dir,
      ...context.environment.jobOnlyVars.build.envVars,
    },
    services: buildConfig.jobServices,
    cache: createJobCacheFromConfig(context, buildConfig),
    stage: "test",
    needs: [],
  };
  const auditJob: CatladderJob | null = buildConfig.audit
    ? new CatladderJob({
        name: "🛡 audit",
        ...base,
        runnerVariables: {
          ...RUNNER_CUSTOM_TEST_VARIABLES,
          ...(buildConfig.audit?.runnerVariables ?? {}),
        },
        image: buildConfig.audit?.jobImage ?? buildConfig.jobImage,
        cache: undefined,
        script: [...ensureArray(buildConfig.audit?.command)],
        allow_failure: buildConfig.audit?.allowFailure ?? true,
        ...createArtifactsConfig(
          context.build.dir,
          buildConfig.audit?.artifactsReports,
          buildConfig.audit?.artifacts,
        ),
      })
    : null;

  const lintJob: CatladderJob | null = buildConfig.lint
    ? new CatladderJob({
        name: "👮 lint",

        ...base,
        runnerVariables: {
          ...RUNNER_CUSTOM_TEST_VARIABLES,
          ...(buildConfig.lint?.runnerVariables ?? {}),
        },
        image: buildConfig.lint?.jobImage ?? buildConfig.jobImage,
        script: [...ensureArray(buildConfig.lint?.command)],
        allow_failure: buildConfig.lint?.allowFailure,
        ...createArtifactsConfig(
          context.build.dir,
          buildConfig.lint?.artifactsReports,
          buildConfig.lint?.artifacts,
        ),
      })
    : null;
  const testJob: CatladderJob | null = buildConfig.test
    ? new CatladderJob({
        name: "🧪 test",

        ...base,
        runnerVariables: {
          ...RUNNER_CUSTOM_TEST_VARIABLES,
          ...(buildConfig.test?.runnerVariables ?? {}),
        },
        image: buildConfig.test?.jobImage ?? buildConfig.jobImage,
        script: [...ensureArray(buildConfig.test?.command)],
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

export type OptionalArtifacts =
  | {
      artifacts: Artifacts;
    }
  | undefined;
