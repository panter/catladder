import type { Artifacts } from "../../types";
import type { ComponentContextWithBuild } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
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

  const base: Omit<CatladderJob, "script" | "name"> = {
    variables: {
      APP_PATH: context.build.dir,
      ...context.environment.jobOnlyVars.build.envVars,
    },
    runnerVariables: RUNNER_CUSTOM_TEST_VARIABLES,
    services: buildConfig.jobServices,
    cache: createJobCacheFromConfig(context, buildConfig),
    stage: "test",
    needs: [],
    envMode: "none",
  };
  const auditJob: CatladderJob | null = buildConfig.audit
    ? {
        name: "🛡 audit",
        ...base,
        image: buildConfig.audit?.jobImage ?? buildConfig.jobImage,
        cache: undefined,
        script: [...ensureArray(buildConfig.audit?.command)],
        allow_failure: true,
        ...createArtifactsConfig(
          context.build.dir,
          buildConfig.audit?.artifactsReports,
          buildConfig.audit?.artifacts,
        ),
      }
    : null;

  const lintJob: CatladderJob | null = buildConfig.lint
    ? {
        name: "👮 lint",

        ...base,
        image: buildConfig.lint?.jobImage ?? buildConfig.jobImage,
        script: [...ensureArray(buildConfig.lint?.command)],
        ...createArtifactsConfig(
          context.build.dir,
          buildConfig.lint?.artifactsReports,
          buildConfig.lint?.artifacts,
        ),
      }
    : null;
  const testJob: CatladderJob | null = buildConfig.test
    ? {
        name: "🧪 test",

        ...base,
        image: buildConfig.test?.jobImage ?? buildConfig.jobImage,
        script: [...ensureArray(buildConfig.test?.command)],
        ...createArtifactsConfig(
          context.build.dir,
          buildConfig.test?.artifactsReports,
          buildConfig.test?.artifacts,
        ),
      }
    : null;
  return [auditJob, lintJob, testJob].filter(notNil);
};

export type OptionalArtifacts =
  | {
      artifacts: Artifacts;
    }
  | undefined;
