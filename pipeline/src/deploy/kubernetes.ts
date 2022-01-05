import { GitlabJobs, GitlabJobDef } from "../types/gitlab-types";
import { Context } from "../types/context";
import { isOfType } from "./types";
import { getRunnerImage } from "../runner";
import { DOCKER_BUILD_JOB_NAME } from "../build/docker";
const DEPLOY_JOB_NAME = "🚀 kubernetes";
export const createKubernetesDeployJobs = (context: Context): GitlabJobs => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfType(deployConfig, "kubernetes")) {
    // should not happen
    throw new Error("deploy config is not kubernetes");
  }

  const defaltKubeValues = {
    application: {
      hostname: context.environment.hostname,
      command: context.componentConfig.build.startCommand,
    },
  };
  const kubeValues = {
    ...defaltKubeValues,
    ...deployConfig.values,
  }; // TODO: merge with some defaults

  const environment = {
    name: context.environment.fullName,
    url: context.environment.url,
    kubernetes: {
      namespace: context.environment.variables.KUBE_NAMESPACE,
    },
  };
  const base: Omit<GitlabJobDef, "stage"> = {
    image: getRunnerImage("kubernetes"),
    variables: {
      ...context.environment.variables,

      MONGODB_ENABLED: "false", // TODO: remove the whole mongodb stuff and put it into values
      // TODO: refactor and unify with other stages
      HELM_EXPERIMENTAL_OCI: "1",
      IMAGE_PULL_SECRET: `gitlab-registry-${context.componentName}`,
      KUBE_VALUES: JSON.stringify(kubeValues),
      HELM_GITLAB_CHART_NAME: "the-panter-chart",
      COMPONENT_NAME: context.componentName,
      // TODO: unify with docker build stage
      IMAGE_TAG: "$CI_COMMIT_SHA",
    },

    dependencies: [],
    // TODO: inline
    script: [
      "kubernetesEnsureNamespace",
      "kubernetesCreateSecret",
      "kubernetesDeploy",
    ],
  };

  const autoStop =
    context.environment.envType === "review"
      ? "2 weeks"
      : context.environment.envType === "dev"
      ? "3 weeks"
      : undefined;
  return [
    {
      name: DEPLOY_JOB_NAME,
      envMode: "stagePerEnv", // makes it easier to run manual tasks er env

      // we don't want to deploy when there is a broken test
      needsStages: ["test"], // workaround for https://gitlab.com/gitlab-org/gitlab/-/issues/220758

      job: {
        ...base,
        rules: [
          context.environment.envType === "prod"
            ? {
                when: "manual",
              }
            : {
                when: "on_success",
              },
        ],
        stage: "deploy",
        dependencies: [],
        needs: [
          {
            job: DOCKER_BUILD_JOB_NAME,
            artifacts: false,
          },
        ],
        script: [
          "kubernetesEnsureNamespace",
          "kubernetesCreateSecret",
          "kubernetesDeploy",
        ],
        environment: {
          ...environment,
          on_stop: "stop kubernetes",
          auto_stop_in: autoStop,
        },
      },
    },
    {
      name: "stop kubernetes",
      envMode: "stagePerEnv", // makes it easier to run manual tasks er env
      job: {
        ...base,
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
          ...base.variables,
          GIT_STRATEGY: "none",
        },
        stage: "stop",
        dependencies: [],
        script: ["kubernetesDelete"],
        environment: {
          ...environment,
          action: "stop",
        },
      },
    },
  ];
};
