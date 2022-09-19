import { dump } from "js-yaml";
import { merge } from "lodash";
import { getSecretVarNameForContext } from "../..";
import { getRunnerImage } from "../../runner";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import {
  getBaseDeploymentJob,
  getBaseDeploymentStopJob,
  getBaseRollbackJob,
} from "../base";
import { isOfDeployType } from "../types";
import { createKubeValues } from "./kubeValues";

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

  const kubeValues = createKubeValues(context);
  const kubernetesEnvironment = {
    namespace: context.environment.envVars.KUBE_NAMESPACE,
  };
  const shared = {
    image: getRunnerImage("kubernetes"),
    variables: {
      ...context.environment.envVars,
      RELEASE_NAME: context.environment.fullName,
      HELM_EXPERIMENTAL_OCI: "1",
      KUBE_DOCKER_IMAGE_PULL_SECRET: `gitlab-registry-${context.componentName}`,
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
    },
  };

  const baseDeploymentJob = getBaseDeploymentJob(context);
  const baseStopJob = getBaseDeploymentStopJob(context);
  const baseRollbackJob = getBaseRollbackJob(context);
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

    merge({}, baseRollbackJob, shared, {
      script: [...connectContext, "kubernetesRollback"],
      environment: {
        kubernetes: kubernetesEnvironment,
      },
    }),
  ];
};
