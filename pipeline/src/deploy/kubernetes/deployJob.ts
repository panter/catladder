import { dump } from "js-yaml";
import { merge } from "lodash";
import { DeployConfigKubernetesValues } from "..";
import { getSecretVarNameForContext } from "../..";
import { getRunnerImage } from "../../runner";
import { Context } from "../../types/context";
import { CatladderJob } from "../../types/jobs";
import { mergeWithMergingArrays } from "../../utils";
import { getBaseDeploymentJob, getBaseDeploymentStopJob } from "../base";
import { isOfDeployType } from "../types";
import { createCloudsqlBaseConfig } from "./cloudsql";
import { createMongodbBaseConfig } from "./mongodb";

export const createKubernetesDeployJobs = (
  context: Context
): CatladderJob[] => {
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
      if (String(value)?.startsWith("$CL_")) {
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

  const defaultAppConfig: DeployConfigKubernetesValues["application"] = {
    host: context.environment.host,
    command: context.componentConfig.build.startCommand,
    livenessProbe: {
      httpGet: {
        path: deployConfig.values?.application?.healthRoute ?? "__health",
      },
    },
    readinessProbe: {
      httpGet: {
        path: deployConfig.values?.application?.healthRoute ?? "__health",
      },
    },
    startupProbe: {
      httpGet: {
        path: deployConfig.values?.application?.healthRoute ?? "__health",
      },
    },
  };

  const defaultKubeValues = {
    application: defaultAppConfig,
    env: env,
    ...(deployConfig.values?.cloudsql?.enabled
      ? createCloudsqlBaseConfig(context)
      : {}),
    ...(deployConfig.values?.mongodb?.enabled
      ? createMongodbBaseConfig(context)
      : {}),
  };

  const kubeValues = mergeWithMergingArrays(
    defaultKubeValues,
    deployConfig.values
  );

  const kubernetesEnvironment = {
    namespace: context.environment.envVars.KUBE_NAMESPACE,
  };
  const shared = {
    image: getRunnerImage("kubernetes"),
    variables: {
      ...context.environment.envVars,
      HELM_EXPERIMENTAL_OCI: "1",
      IMAGE_PULL_SECRET: `gitlab-registry-${context.componentName}`,
      KUBE_VALUES: dump(kubeValues, {
        lineWidth: -1,
        quotingType: "'",
        forceQuotes: true,
      }),
      HELM_GITLAB_CHART_NAME: "the-panter-chart",
      HELM_ARGS: [
        ...(deployConfig.debug ? ["--debug"] : []),
        ...(deployConfig.additionalHelmArgs ?? []),
      ].join(" "),
      COMPONENT_NAME: context.componentName,
      BUILD_ID: context.commitInfo?.buildId,
      // TODO: unify with docker build stage
      IMAGE_NAME: context.environment.shortName + "/" + context.componentName,
      IMAGE_TAG: "$CI_COMMIT_SHA",
    },
  };

  const baseDeploymentJob = getBaseDeploymentJob(context);
  const baseStopJob = getBaseDeploymentStopJob(context);
  const clusterName = `kube-${context.environment.fullName}`;
  const connectContext = [
    `kubectl config set-cluster "${clusterName}" --server="$${getSecretVarNameForContext(
      context,
      "KUBE_URL"
    )}" --certificate-authority <(echo $${getSecretVarNameForContext(
      context,
      "KUBE_CA_PEM"
    )} | base64 -d) --embed-certs=true`,
    `kubectl config set-credentials "${clusterName}" --token="$${getSecretVarNameForContext(
      context,
      "KUBE_TOKEN"
    )}"`,
    `kubectl config set-context "${clusterName}" --cluster="${clusterName}" --user="${clusterName}" --namespace="${context.environment.envVars.KUBE_NAMESPACE}"`,
    `kubectl config use-context "${clusterName}"`,
  ];
  return [
    merge({}, baseDeploymentJob, shared, {
      script: [
        ...connectContext,
        "kubernetesCreateSecret",
        "kubernetesDeploy",
        "echo deployment successful 😻",
      ],
      environment: {
        kubernetes: kubernetesEnvironment,
      },
    }),
    merge({}, baseStopJob, shared, {
      script: [...connectContext, "kubernetesDelete"],
      environment: {
        kubernetes: kubernetesEnvironment,
      },
    }),
  ];
};
