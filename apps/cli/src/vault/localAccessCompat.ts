import type { Config, SecretsVaultConfig } from "@catladder/pipeline";
import { getVaultConfig } from "@catladder/pipeline";

type VaultConfigObject = Exclude<SecretsVaultConfig, string>;

/**
 * localAccess stores a service account key in the secret store, so it needs a
 * vault whose access is not what the key itself would unlock.
 *
 * returns a reason (why the vault cannot hold the key) or `null` if the vault
 * is compatible.
 */
export const isVaultIncompatibleWithLocalAccess = (
  vaultConfig: VaultConfigObject,
): string | null => {
  switch (vaultConfig.type) {
    case "gitlab":
      // the gitlab vault stores secrets as CI variables available to every
      // job on every branch: the key would leak to anyone who can push
      return "the gitlab vault is a CI variable store and would expose the service account key to every CI job";
    case "google-secret-manager":
      // the localAccess key would be the vault's own bootstrap secret: reading
      // it needs the very credentials it is supposed to provide
      return "the google-secret-manager vault cannot hold the localAccess key: reading it would need the credentials the key is meant to provide";
    default:
      return null;
  }
};

export const getLocalAccessVaultIncompatibility = (
  config: Config,
): string | null => isVaultIncompatibleWithLocalAccess(getVaultConfig(config));
