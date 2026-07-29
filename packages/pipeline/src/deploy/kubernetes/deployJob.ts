import { getCiVariable } from "../../bash/ciVariables";
import { getSecretVarNameForContext } from "../../context/getEnvironmentVariables";
import { getRunnerImage } from "../../runner";
import type { ComponentContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createDeployementJobs } from "../base";

import { isOfDeployType } from "../types";
import { createKubeValues } from "./kubeValues";

import { writeBashYamlToFileScript } from "@catladder/bash";
import { collapseableSection } from "../../utils/gitlab";

const ALL_VALUES_FILE = "__all_values.yml";
export const createKubernetesDeployJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    // should not happen
    throw new Error("deploy config is not kubernetes");
  }

  const shared: Pick<CatladderJob, "image" | "variables" | "artifacts"> = {
    image: getRunnerImage("kubernetes"),
    ...(deployConfig.debug
      ? {
          artifacts: {
            paths: [
              ALL_VALUES_FILE, // debug
            ],
            when: "always",
          },
        }
      : {}),
    variables: {
      ...context.environment.envVars,
      RELEASE_NAME: context.environment.fullName,
      HELM_EXPERIMENTAL_OCI: "1",
      KUBE_DOCKER_IMAGE_PULL_SECRET: `gitlab-registry-${context.name}`,
      // credentials for the image pull secret kubernetesCreateSecret
      // writes into the namespace. Resolved per backend (gitlab: the
      // registry user + password, github: the actor + workflow token)
      // so the script itself stays backend-agnostic.
      DOCKER_REGISTRY_USER: getCiVariable(context, "registryUser"),
      DOCKER_REGISTRY_PASSWORD: getCiVariable(context, "registryPassword"),
      HELM_GITLAB_CHART_NAME:
        deployConfig.chartName ?? "/helm-charts/the-panter-chart",
      HELM_ARGS: [
        ...(deployConfig.debug ? ["--debug"] : []),
        ...(deployConfig.additionalHelmArgs ?? []),
      ].join(" "),
      COMPONENT_NAME: context.name,
    },
  };

  const clusterName = `kube-${context.environment.fullName}`;
  const connectContext = [
    `kubectl config set-cluster "${clusterName}" --server="$${getSecretVarNameForContext(
      context,
      "KUBE_URL",
    )}" --certificate-authority <(echo $${getSecretVarNameForContext(
      context,
      "KUBE_CA_PEM",
    )} | base64 -d) --embed-certs=true`,
    `kubectl config set-credentials "${clusterName}" --token="$${getSecretVarNameForContext(
      context,
      "KUBE_TOKEN",
    )}"`,
    `kubectl config set-context "${clusterName}" --cluster="${clusterName}" --user="${clusterName}" --namespace="${context.environment.envVars.KUBE_NAMESPACE}"`,
    `kubectl config use-context "${clusterName}"`,
  ];

  return createDeployementJobs(context, {
    deploy: {
      ...shared,
      script: [
        ...connectContext,
        ...collapseableSection(
          "writeallvalues",
          "Write " + ALL_VALUES_FILE + " for helm deployment",
        )(
          writeBashYamlToFileScript(createKubeValues(context), ALL_VALUES_FILE),
        ),
        "kubernetesCreateSecret",
        "kubernetesDeploy",

        "echo deployment successful 😻",
      ],
    },
    stop: {
      ...shared,
      script: [...connectContext, "kubernetesDelete"],
    },
    rollback: {
      ...shared,
      script: [...connectContext, "kubernetesRollback"],
    },
  });
};
