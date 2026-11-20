import type { Config } from "@catladder/pipeline";
import { getVaultConfig } from "@catladder/pipeline";
import { enableGCloudServices } from "../../../../../gcloud/enableServices";
import type { IO } from "../../../../../core/types";
import { resolveGsmProject } from "../../../../../vault/GoogleSecretManagerVault";

export const SECRET_MANAGER_API = "secretmanager.googleapis.com";

/**
 * the google-secret-manager vault needs the Secret Manager API in its
 * project before the first secret is written. No-op for other vaults.
 */
export const setupSecretManager = async (instance: IO, config: Config) => {
  const vaultConfig = getVaultConfig(config);
  if (vaultConfig.type !== "google-secret-manager") return;

  const projectId = resolveGsmProject(config, vaultConfig);
  instance.log(`enable Secret Manager API in ${projectId}...`);
  await enableGCloudServices([SECRET_MANAGER_API], { projectId });
};
