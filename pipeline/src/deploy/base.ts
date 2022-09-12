import { getDockerImageVariables, requiresDockerBuild } from "../build/docker";
import type { Context } from "../types";
import type { CatladderJob } from "../types/jobs";
import { contextIsStoppable } from "./utils";

export const DEPLOY_JOB_NAME = "🚀 Deploy";
export const STOP_JOB_NAME = "🛑 Stop ⚠️";
export const ROLLBACK_JOB_NAME = "↩️ Rollback ⚠️";

const DEPLOY_RUNNER_VARIABLES = {
  KUBERNETES_CPU_REQUEST: "0.5",
  KUBERNETES_CPU_LIMIT: "1",
  KUBERNETES_MEMORY_REQUEST: "200Mi",
  KUBERNETES_MEMORY_LIMIT: "500Mi",
};
type JobWithoutScript = Omit<CatladderJob, "script">;
export const getBaseDeploymentJob = (context: Context): JobWithoutScript => {
  const environment = {
    name: context.environment.fullName,
    url: context.environment.url,
  };

  const hasDocker = requiresDockerBuild(context);
  const isStoppable = contextIsStoppable(context);

  const autoStop =
    context.environment.envType === "review"
      ? "3 days" // auto stop is not working properly when branch is merged, so we do
      : context.environment.envType === "dev"
      ? "3 weeks"
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
    envMode: "stagePerEnv", // makes it easier to run manual tasks er env

    needsOtherComponent: context.componentConfig.deploy
      ? context.componentConfig.deploy.waitFor?.map((c) => ({
          componentName: c,
          job: DEPLOY_JOB_NAME,
          artifacts: false,
        })) ?? undefined
      : undefined,
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
    },
    environment: {
      ...environment,
      ...(isStoppable
        ? {
            on_stop: STOP_JOB_NAME,
            auto_stop_in: autoStop,
          }
        : {}),
    },
  };
};

export const getBaseDeploymentStopJob = (
  context: Context
): JobWithoutScript => {
  const environment = {
    name: context.environment.fullName,
    url: context.environment.url,
  };
  return {
    name: STOP_JOB_NAME,
    envMode: "stagePerEnv", // makes it easier to run manual tasks er env

    needs: [DEPLOY_JOB_NAME],
    rules: [
      {
        if: "$CI_COMMIT_BRANCH =~ /^[0-9]+\\.([0-9]+|x)\\.x$/", // automatic on hotfix branches
        when: "on_success",
        allow_failure: true,
      },
      {
        when: "manual",
        allow_failure: true,
      },
    ],
    variables: {
      ...DEPLOY_RUNNER_VARIABLES,
      GIT_STRATEGY: "none",
    },
    stage: "stop",
    environment: {
      ...environment,
      action: "stop",
    },
  };
};

export const getBaseRollbackJob = (context: Context): JobWithoutScript => {
  const environment = {
    name: context.environment.fullName,
    url: context.environment.url,
  };
  return {
    name: ROLLBACK_JOB_NAME,
    envMode: "stagePerEnv", // makes it easier to run manual tasks er env
    needs: [], // can be executed even if the deploy job failed
    rules: [
      {
        when: "manual",
        allow_failure: true,
      },
    ],
    variables: {
      ...DEPLOY_RUNNER_VARIABLES,
      GIT_STRATEGY: "none",
    },
    stage: "rollback",
    environment: {
      ...environment,
      action: "access",
    },
  };
};
