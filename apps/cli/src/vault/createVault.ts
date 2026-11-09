import type { Config, SecretsVaultConfig } from "@catladder/pipeline";
import { BitwardenVault } from "./BitwardenVault";
import { GitlabVault } from "./GitlabVault";
import type { SecretsVault } from "./types";

/**
 * builds the vault for a (normalized) vault config. Not tied to the
 * configured vault, so commands can address any vault (e.g. a
 * migration source and target).
 *
 * @param canPrompt whether a locked vault may be unlocked interactively
 * (unlock prompts need a mode that allows them AND an IO that can
 * actually prompt — catenv under direnv/turbo/CI cannot)
 */
export const createVault = (
  config: Config,
  vaultConfig: Exclude<SecretsVaultConfig, string>,
  canPrompt: boolean,
): SecretsVault => {
  switch (vaultConfig.type) {
    case "gitlab":
      return new GitlabVault();
    case "bitwarden":
      return new BitwardenVault(config, vaultConfig, canPrompt);
  }
};
