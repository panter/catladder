import { getProjectConfig } from "../config/getProjectConfig";
import type { IO } from "../core/types";
import type { VaultManagerOptions } from "../vault/VaultManager";
import { VaultManager } from "../vault/VaultManager";

/**
 * lazily creates the vault manager of a context (once per context),
 * loading the project config on first use
 */
export const createVaultManagerGetter = (
  io: () => IO,
  options: Omit<VaultManagerOptions, "io"> = {},
): (() => Promise<VaultManager>) => {
  let managerPromise: Promise<VaultManager> | undefined;
  return () =>
    (managerPromise ??= (async () => {
      const config = await getProjectConfig();
      if (!config) {
        throw new Error(
          "no catladder config found — the secrets vault needs a project config",
        );
      }
      return new VaultManager(config, { ...options, io: io() });
    })());
};
