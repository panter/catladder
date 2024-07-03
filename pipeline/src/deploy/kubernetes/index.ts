import slugify from "slugify";
import type { DeployConfigKubernetes, DeployTypeDefinition } from "..";
import { getKubernetesNamespace } from "..";
import { joinBashExpressions } from "../../bash/BashExpression";
import { additionalKubernetesSecretKeys } from "./additionalSecretKeys";
import { createKubernetesDeployJobs } from "./deployJob";
export * from "./cloudSql";
export const KUBERNETES_DEPLOY_TYPE: DeployTypeDefinition<DeployConfigKubernetes> =
  {
    jobs: createKubernetesDeployJobs,
    defaults: () => ({}),
    additionalSecretKeys: additionalKubernetesSecretKeys,
    getAdditionalEnvVars: ({
      componentName,
      fullConfig,
      deployConfigRaw,
      env,
      reviewSlug,
      envType,
    }) => {
      const KUBE_APP_NAME_PREFIX =
        envType === "review" && reviewSlug ? reviewSlug.concat("-") : "";
      const KUBE_APP_NAME = KUBE_APP_NAME_PREFIX.concat(componentName);
      const KUBE_NAMESPACE = getKubernetesNamespace(fullConfig, env);
      const componentSlug = slugify(componentName);

      const domainCanonical =
        (deployConfigRaw && deployConfigRaw.cluster?.domainCanonical) || // for convenience, we allow clusters to define a canonical domain, because a cluster has a fixed ip and you will usually have a domain pointing to that cluster
        fullConfig.domainCanonical ||
        "panter.cloud";

      const HOSTNAME_INTERNAL = joinBashExpressions(
        [
          componentSlug,
          ...(envType === "review" && reviewSlug ? [reviewSlug] : []),
          env,
          fullConfig.appName,
          fullConfig.customerName,
          domainCanonical,
        ],
        ".",
      ); // default for kubernetes and rest
      return {
        KUBE_NAMESPACE,
        KUBE_APP_NAME,
        KUBE_APP_NAME_PREFIX,
        HOSTNAME_INTERNAL,
      };
    },
  };
