import { GitlabJobs, GitlabJobDef } from "../types/gitlab-types";
import { Context } from "../types/context";
import { isOfType } from "./types";
import { getRunnerImage } from "../runner";

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
      HELM_GITLAB_CHART_VERSION: "3.2.0", // TODO, we could actually just ship the chart directly here
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
      name: "deploy-to-kubernetes",

      job: {
        ...base,
        stage: "deploy",
        dependencies: [],
        script: [
          "kubernetesEnsureNamespace",
          "kubernetesCreateSecret",
          "kubernetesDeploy",
        ],
        environment: {
          ...environment,
          on_stop: "kubernetes-stop",
          auto_stop_in: autoStop,
        },
      },
    },
    {
      name: "kubernetes-stop",
      job: {
        ...base,
        needs: ["deploy-to-kubernetes"],
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
        stage: "actions",
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
