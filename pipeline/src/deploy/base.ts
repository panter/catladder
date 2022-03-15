import { Context } from "../types";
import { CatladderJob } from "../types/jobs";

export const DEPLOY_JOB_NAME = "🚀 Deploy";
export const STOP_JOB_NAME = "🛑 Stop ⚠️";

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

  const autoStop =
    context.environment.envType === "review"
      ? "2 weeks"
      : context.environment.envType === "dev"
      ? "3 weeks"
      : undefined;
  // automatically run deploy job, unless its prod and stage is active
  const autoDeploy =
    context.environment.envType !== "prod"
      ? true // is not stage, auto deploy
      : context.componentConfig.env?.stage === false
      ? true // is prod, but no staging, auto deploy
      : false; // manually deploy
  return {
    name: DEPLOY_JOB_NAME,
    envMode: "stagePerEnv", // makes it easier to run manual tasks er env
    // we don't want to deploy when there is a broken test
    needsStages: [
      {
        stage: "build",
        artifacts: false,
      },
      {
        stage: "test",
        artifacts: false,
      },
    ], // workaround for https://gitlab.com/gitlab-org/gitlab/-/issues/220758

    rules: [
      autoDeploy
        ? {
            when: "on_success",
          }
        : {
            when: "manual",
          },
    ],
    stage: "deploy",
    variables: {
      ...DEPLOY_RUNNER_VARIABLES,
    },
    environment: {
      ...environment,
      on_stop: STOP_JOB_NAME,
      auto_stop_in: autoStop,
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
