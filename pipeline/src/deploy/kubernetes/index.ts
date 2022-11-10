import slugify from "slugify";
import type { DeployTypeDefinition } from "..";
import { getKubernetesNamespace } from "..";
import { additionalKubernetesSecretKeys } from "./additionalSecretKeys";
import { createKubernetesDeployJobs } from "./deployJob";

export const KUBERNETES_DEPLOY_TYPE: DeployTypeDefinition<"kubernetes"> = {
  jobs: createKubernetesDeployJobs,
  defaults: () => ({}),
  additionalSecretKeys: additionalKubernetesSecretKeys,
  getAdditionalEnvVars: ({
    componentName,
    fullConfig,
    deployConfig,
    env,
    envType,
    commitInfo,
  }) => {
    const KUBE_APP_NAME_PREFIX =
      envType === "review" && commitInfo ? `${commitInfo.reviewSlug}-` : "";
    const KUBE_APP_NAME = `${KUBE_APP_NAME_PREFIX}${componentName}`;
    const KUBE_NAMESPACE = getKubernetesNamespace(fullConfig, env);
    const componentSlug = slugify(componentName);
    const envInUrl =
      envType === "review" && commitInfo
        ? `${commitInfo.reviewSlug}.${env}`
        : env;

    const domainCanonical =
      (deployConfig && deployConfig.cluster?.domainCanonical) || // for convenience, we allow clusters to define a canonical domain, because a cluster has a fixed ip and you will usually have a domain pointing to that cluster
      fullConfig.domainCanonical ||
      "panter.cloud";
    const HOST_CANONICAL = `${componentSlug}.${envInUrl}.${fullConfig.appName}.${fullConfig.customerName}.${domainCanonical}`; // default for kubernetes and rest

    return {
      KUBE_NAMESPACE,
      KUBE_APP_NAME,
      KUBE_APP_NAME_PREFIX,
      HOST_CANONICAL,
    };
  },
};
