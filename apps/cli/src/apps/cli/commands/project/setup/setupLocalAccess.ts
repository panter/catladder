import type { ComponentContext } from "@catladder/pipeline";
import {
  getLocalAccessGcpRoles,
  getVaultConfig,
  isOfDeployType,
} from "@catladder/pipeline";
import { getProjectConfig } from "../../../../../config/getProjectConfig";
import type { IO } from "../../../../../core/types";
import { syncLocalAccessServiceAccount } from "../../../../../gcloud/localAccess";

/**
 * provisions the read-only local access (`localAccess` in catladder.ts)
 * of a google cloud run component/env: a dedicated service account with
 * exactly the declared bindings and its key in the secret store. Also
 * removes what is no longer declared.
 */
export const setupLocalAccess = async (
  instance: IO,
  context: ComponentContext,
) => {
  const config = context.deploy?.config;
  if (!isOfDeployType(config, "google-cloudrun")) return;
  const projectConfig = await getProjectConfig();
  const roles = getLocalAccessGcpRoles(projectConfig, context.env);

  if (roles.length > 0 && getVaultConfig(projectConfig).type === "gitlab") {
    // the gitlab vault stores secrets as CI variables available to every
    // job on every branch: the key would leak to anyone who can push
    throw new Error(
      `localAccess (${context.env}:${context.name}) needs a vault that is not a CI variable store (e.g. bitwarden): the gitlab vault would expose the service account key to every CI job. Configure \`vault\` or remove the localAccess declaration.`,
    );
  }

  instance.log("sync local access service account...");
  await syncLocalAccessServiceAccount(
    instance,
    context,
    config.projectId,
    roles,
  );
};
