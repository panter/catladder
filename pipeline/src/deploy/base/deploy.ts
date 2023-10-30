import {
  getDockerImageVariables,
  requiresDockerBuild,
} from "../../build/docker";
import { SBOM_BUILD_JOB_NAME } from "../../build/sbom";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { sbomDeactivated } from "../sbom";
import { contextIsStoppable } from "../utils";
import { STOP_JOB_NAME } from "./stop";

import { DEPLOY_RUNNER_VARIABLES } from "./variables";

export const DEPLOY_JOB_NAME = "🚀 Deploy";

export type DeployJobDefinition = Pick<
  CatladderJob,
  "script" | "variables" | "image" | "cache" | "artifacts" | "services"
>;
export const createDeployJob = (
  context: Context,
  jobDefinition: DeployJobDefinition
): CatladderJob => {
  const hasDocker = requiresDockerBuild(context);
  const isStoppable = contextIsStoppable(context);

  const autoStop =
    context.environment.envType === "review"
      ? "1 week"
      : context.environment.envType === "dev"
      ? "4 weeks"
      : undefined;

  // if auto or manual is configured explicitly, use that
  const whenDeployDefined =
    context.componentConfig.deploy && context.componentConfig.deploy.when
      ? context.componentConfig.deploy.when
      : undefined;
  // otherwise auto deploy if env is not prod. If its prod, deploy automatically if stage is disabled
  const whenDeployDefault =
    context.environment.envType !== "prod"
      ? "auto" // is not stage, auto deploy
      : context.componentConfig.env?.stage === false
      ? "auto" // is prod, but no staging, auto deploy
      : "manual"; // manually deploy
  const whenDeploy = whenDeployDefined ? whenDeployDefined : whenDeployDefault;

  return {
    name: DEPLOY_JOB_NAME,
    script: jobDefinition.script,
    image: jobDefinition.image,
    cache: jobDefinition.cache,
    artifacts: jobDefinition.artifacts,
    services: jobDefinition.services,
    envMode: "stagePerEnv", // makes it easier to run manual tasks er env

    needs: [
      ...(sbomDeactivated(context)
        ? []
        : [{ job: SBOM_BUILD_JOB_NAME, artifacts: true }]),
      ...(context.componentConfig.deploy
        ? context.componentConfig.deploy.waitFor?.map((c) => ({
            componentName: c,
            job: DEPLOY_JOB_NAME,
            artifacts: false,
          })) ?? []
        : []),
    ],
    // we don't want to deploy when there is a broken test
    needsStages: [
      {
        stage: "build",
        artifacts: hasDocker ? false : true, // we asume that no-docker deployments need build artifacts,
      },
      {
        stage: "test",
        artifacts: false,
      },
    ], // workaround for https://gitlab.com/gitlab-org/gitlab/-/issues/220758
    rules: [
      whenDeploy === "auto"
        ? {
            when: "on_success",
          }
        : {
            when: "manual",
          },
    ],
    allow_failure: whenDeploy === "manual" ? true : false,
    stage: "deploy",
    variables: {
      ...DEPLOY_RUNNER_VARIABLES,
      ...context.environment.envVars,
      ...(hasDocker ? getDockerImageVariables(context) : {}),
      ...context.environment.jobOnlyVars.deploy.envVars,
      ...(context.componentConfig.deploy
        ? context.componentConfig.deploy.extraVars ?? {}
        : {}),
      ...jobDefinition.variables,
    },
    environment: {
      ...context.environment.gitlabEnvironment,
      ...(isStoppable
        ? {
            on_stop: STOP_JOB_NAME,
            auto_stop_in: autoStop,
          }
        : {}),
    },
    jobTags: context.componentConfig.deploy
      ? context.componentConfig.deploy.jobTags
      : undefined,
  };
};
