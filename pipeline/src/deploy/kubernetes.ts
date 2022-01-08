import { GitlabJobs } from "../types/gitlab-types";
import { Context } from "../types/context";
import { isOfDeployType } from "./types";
import { getRunnerImage } from "../runner";
import { getBaseDeploymentJob, getBaseDeploymentStopJob } from "./base";
import { merge } from "lodash";

export const createKubernetesDeployJobs = (context: Context): GitlabJobs => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    // should not happen
    throw new Error("deploy config is not kubernetes");
  }

  const allEnvVars = context.environment.envVars;
  /**
   * separate by secrets and public.
   * we evalulate the actual values later, but want to store the secrets in kubernetes secrets
   */
  const env = Object.entries(allEnvVars).reduce<{
    secret: Record<string, string>;
    public: Record<string, string>;
  }>(
    (acc, [key, value]) => {
      if (value?.startsWith("$CL_")) {
        acc.secret = {
          ...acc.secret,
          [key]: value,
        };
        return acc;
      }
      acc.public = {
        ...acc.public,
        [key]: value,
      };
      return acc;
    },
    {
      secret: {},
      public: {},
    }
  );

  const defaultKubeValues = {
    application: {
      hostname: context.environment.hostname,
      command: context.componentConfig.build.startCommand,
    },
    env: env,
  };
  const kubeValues = merge({}, defaultKubeValues, deployConfig.values);

  const kubernetesEnvironment = {
    namespace: context.environment.envVars.KUBE_NAMESPACE,
  };
  const shared = {
    job: {
      image: getRunnerImage("kubernetes"),
      variables: {
        ...context.environment.envVars,

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
    },
  };

  const baseDeploymentJob = getBaseDeploymentJob(context);
  const baseStopJob = getBaseDeploymentStopJob(context);

  return [
    merge({}, baseDeploymentJob, shared, {
      job: {
        script: [
          "kubernetesEnsureNamespace",
          "kubernetesCreateSecret",
          "kubernetesDeploy",
        ],
        environment: {
          kubernetes: kubernetesEnvironment,
        },
      },
    }),
    merge({}, baseStopJob, shared, {
      job: {
        script: ["kubernetesDelete"],
        environment: {
          kubernetes: kubernetesEnvironment,
        },
      },
    }),
  ];
};
