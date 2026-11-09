import type { Config, SecretsVaultConfig } from "@catladder/pipeline";
import { getVaultConfig } from "@catladder/pipeline";

export type VaultType = Exclude<SecretsVaultConfig, string>["type"];

export type VaultOptions = {
  /** bitwarden collection holding the secret notes */
  collection?: string;
};

/**
 * builds the vault config for a `--from` / `--to` vault: the type plus
 * its collection flag. Options not given fall back to those of the
 * configured vault — but only when its type matches, so a bitwarden
 * collection never leaks into another vault type.
 */
export const resolveVaultConfig = (
  type: VaultType,
  options: VaultOptions,
  config: Config,
): Exclude<SecretsVaultConfig, string> => {
  const configured = getVaultConfig(config);
  switch (type) {
    case "gitlab":
      return { type: "gitlab" };
    case "bitwarden": {
      const collection =
        options.collection ??
        (configured.type === "bitwarden" ? configured.collection : undefined);
      return collection === undefined
        ? { type: "bitwarden" }
        : { type: "bitwarden", collection };
    }
  }
};
