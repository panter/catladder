import { getSecretVarNameForContext } from "../../context/getEnvironmentVariables";
import { getRunnerImage } from "../../runner";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createDeployementJobs } from "../base";
import {
  getDependencyTrackDeleteScript,
  getDependencyTrackUploadScript,
} from "../sbom";
import { isOfDeployType } from "../types";
import { createKubeValues } from "./kubeValues";

import { writeBashYamlToFileScript } from "../../bash/bashYaml";
import { collapseableSection } from "../../utils/gitlab";

const ALL_VALUES_FILE = "__all_values.yml";
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
      KUBE_DOCKER_IMAGE_PULL_SECRET: `gitlab-registry-${context.componentName}`,
      HELM_GITLAB_CHART_NAME:
        deployConfig.chartName ?? "/helm-charts/the-panter-chart",
      HELM_ARGS: [
        ...(deployConfig.debug ? ["--debug"] : []),
        ...(deployConfig.additionalHelmArgs ?? []),
      ].join(" "),
      COMPONENT_NAME: context.componentName,
      /** @deprecated */
      BUILD_ID: context.environment.envVars.BUILD_INFO_BUILD_ID,
    },
  };

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

  return createDeployementJobs(context, {
    deploy: {
      ...shared,
      script: [
        ...connectContext,
        ...collapseableSection(
          "writeallvalues",
          "Write " + ALL_VALUES_FILE + " for helm deployment"
        )(
          writeBashYamlToFileScript(createKubeValues(context), ALL_VALUES_FILE)
        ),
        "kubernetesCreateSecret",
        "kubernetesDeploy",
        ...getDependencyTrackUploadScript(context),
        "echo deployment successful 😻",
      ],
    },
    stop: {
      ...shared,
      script: [
        ...connectContext,
        "kubernetesDelete",
        ...getDependencyTrackDeleteScript(context),
      ],
    },
    rollback: {
      ...shared,
      script: [...connectContext, "kubernetesRollback"],
    },
  });
};
