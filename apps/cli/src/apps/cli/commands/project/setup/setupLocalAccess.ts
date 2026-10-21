import type { ComponentContext } from "@catladder/pipeline";
import { getLocalAccessGcpRoles, isOfDeployType } from "@catladder/pipeline";
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

  instance.log("sync local access service account...");
  await syncLocalAccessServiceAccount(
    instance,
    context,
    config.projectId,
    roles,
  );
};
