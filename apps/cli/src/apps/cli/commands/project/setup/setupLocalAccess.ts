import type { ComponentContext } from "@catladder/pipeline";
import {
  getLocalAccessGcpCredentialsEnvVars,
  getLocalAccessGcpRoles,
  isOfDeployType,
} from "@catladder/pipeline";
import { getProjectConfig } from "../../../../../config/getProjectConfig";
import type { IO } from "../../../../../core/types";
import { syncLocalAccessServiceAccount } from "../../../../../gcloud/localAccess";
import { getLocalAccessVaultIncompatibility } from "../../../../../vault/localAccessCompat";

/**
 * provisions the local access (`localAccess` in catladder.ts)
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
  // validates `credentialsEnvVar` (catenv silently skips invalid ones)
  getLocalAccessGcpCredentialsEnvVars(projectConfig, context.name);

  const incompatible =
    roles.length > 0 ? getLocalAccessVaultIncompatibility(projectConfig) : null;
  if (incompatible) {
    throw new Error(
      `localAccess (${context.env}:${context.name}) cannot use the configured vault: ${incompatible}. Configure another \`vault\` (e.g. bitwarden) or remove the localAccess declaration.`,
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
