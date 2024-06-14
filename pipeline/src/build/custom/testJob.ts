import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray, notNil } from "../../utils";
import { isOfBuildType } from "../types";
import type { Artifacts } from "../../types";
import { createArtifactsConfig } from "../base/createArtifactsConfig";

const RUNNER_CUSTOM_TEST_VARIABLES = {
  KUBERNETES_CPU_REQUEST: "0.5",
  KUBERNETES_MEMORY_REQUEST: "2Gi",
  KUBERNETES_MEMORY_LIMIT: "4Gi",
};

export const createCustomTestJobs = (context: Context): CatladderJob[] => {
  // don't run tests after release
  // TODO: this will be replaced by using rules
  if (context.trigger === "taggedRelease") {
    return [];
  }

  const buildConfig = context.componentConfig.build;

  if (!isOfBuildType(buildConfig, "custom")) {
    throw new Error("deploy config is not custom");
  }

  const base: Omit<CatladderJob, "script" | "name"> = {
    variables: {
      APP_PATH: context.componentConfig.dir,
      ...context.environment.jobOnlyVars.build.envVars,
      ...(buildConfig.extraVars ?? {}),
    },
    runnerVariables: RUNNER_CUSTOM_TEST_VARIABLES,
    services: buildConfig.jobServices,
    cache: buildConfig.jobCache,
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
        script: [...(ensureArray(buildConfig.audit?.command) ?? [])],
        allow_failure: true,
        ...createArtifactsConfig(
          context.componentConfig.dir,
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
        script: [...(ensureArray(buildConfig.lint?.command) ?? [])],
        ...createArtifactsConfig(
          context.componentConfig.dir,
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
        script: [...(ensureArray(buildConfig.test?.command) ?? [])],
        ...createArtifactsConfig(
          context.componentConfig.dir,
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
