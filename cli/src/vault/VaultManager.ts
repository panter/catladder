import type { Config } from "@catladder/pipeline";
import {
  getEnvironment,
  getSecretVarName,
  getVaultConfig,
} from "@catladder/pipeline";
import type { IO } from "../core/types";
import { BitwardenVault } from "./BitwardenVault";
import type { CachedSecrets } from "./cache";
import {
  readSecretsCache,
  updateSecretsCache,
  writeSecretsCache,
} from "./cache";
import { GitlabVault } from "./GitlabVault";
import type { SecretsMode, SecretsVault } from "./types";

/**
 * only secrets of this env are cached locally — the other envs'
 * secrets have no business sitting on developer machines
 */
const CACHED_ENV = "local";

export type VaultManagerOptions = {
  mode?: SecretsMode;
  /**
   * default IO for vault interactions (logging, unlock prompts).
   * Method-level io takes precedence.
   */
  io?: IO | null;
};

/**
 * owns the configured vault, the secrets mode and the local cache.
 * The vault is the readable source of truth for secrets; CI backends
 * only receive mirrored copies.
 */
export class VaultManager {
  readonly mode: SecretsMode;

  readonly vault: SecretsVault;

  private readonly io: IO | null;

  /** refresh mode bypasses the cache only once per manager */
  private refreshed = false;

  constructor(
    private readonly config: Config,
    options: VaultManagerOptions = {},
  ) {
    this.mode = options.mode ?? "auto";
    this.io = options.io ?? null;
    this.vault = this.createVault();
  }

  private createVault(): SecretsVault {
    const vaultConfig = getVaultConfig(this.config);
    switch (vaultConfig.type) {
      case "gitlab":
        return new GitlabVault();
      case "bitwarden":
        return new BitwardenVault(
          this.config,
          vaultConfig,
          this.mode === "auto" || this.mode === "refresh",
        );
    }
  }

  /**
   * the vault secrets, served from the local cache when it contains
   * all required names; otherwise (depending on the mode) refreshed
   * from the vault. Only the "local" env is (re-)cached.
   */
  async readSecrets(
    requiredNames: string[],
    io: IO | null = this.io,
  ): Promise<Record<string, string>> {
    const bypassCache = this.mode === "refresh" && !this.refreshed;
    const cache = bypassCache ? null : await readSecretsCache();
    // known entries include recorded misses (null values), so declared
    // but intentionally unset secrets don't force a vault refresh
    const known =
      cache?.vaultId === this.vault.id
        ? flattenSecrets(cache.secrets)
        : undefined;

    const missing = requiredNames.filter((name) => !(name in (known ?? {})));
    // nothing missing (or nothing required at all): don't touch the vault
    if (missing.length === 0 && (known || requiredNames.length === 0)) {
      return withoutMisses(known ?? {});
    }

    if (this.mode === "offline") {
      if (missing.length > 0) {
        io?.log(
          `⚠️ vault is offline (--vault-mode offline) and ${missing.length} secrets are not in the local cache: ${missing.join(", ")}`,
        );
      }
      return withoutMisses(known ?? {});
    }

    const secrets = await this.vault.readAllSecrets(io);
    this.refreshed = true;
    await writeSecretsCache(this.vault.id, await this.cacheableSubset(secrets));
    return secrets;
  }

  /**
   * writes secrets of one env/component to the vault and updates the
   * local cache (write-through, "local" env only)
   */
  async writeSecrets(
    env: string,
    componentName: string,
    secrets: Record<string, unknown>,
    io: IO | null = this.io,
  ): Promise<void> {
    if (!io) {
      throw new Error("writing to the vault requires an interactive context");
    }
    await this.vault.writeSecrets(io, env, componentName, secrets);
    if (env === CACHED_ENV) {
      await updateSecretsCache(
        this.vault.id,
        env,
        componentName,
        Object.fromEntries(
          Object.entries(secrets).map(([key, value]) => [
            key,
            typeof value === "string" ? value : JSON.stringify(value),
          ]),
        ),
      );
    }
  }

  /**
   * the subset of the vault secrets that may be cached: the declared
   * secrets of the "local" env, per component, as a hierarchy
   */
  private async cacheableSubset(
    flatSecrets: Record<string, string>,
  ): Promise<CachedSecrets> {
    const local: CachedSecrets[string] = {};
    for (const componentName of Object.keys(this.config.components)) {
      const keys = await this.declaredSecretKeys(componentName);
      const values = Object.fromEntries(
        keys.map((key): [string, string | null] => [
          key,
          // null records "absent in the vault" (a known miss)
          flatSecrets[getSecretVarName(CACHED_ENV, componentName, key)] ?? null,
        ]),
      );
      if (Object.keys(values).length > 0) {
        local[componentName] = values;
      }
    }
    return Object.keys(local).length > 0 ? { [CACHED_ENV]: local } : {};
  }

  private async declaredSecretKeys(componentName: string): Promise<string[]> {
    try {
      const { secretEnvVarKeys, jobOnlyVars } = await getEnvironment({
        config: this.config,
        componentName,
        env: CACHED_ENV,
      });
      return [
        ...secretEnvVarKeys,
        ...jobOnlyVars.build.secretEnvVarKeys,
        ...jobOnlyVars.deploy.secretEnvVarKeys,
      ].map(({ key }) => key);
    } catch {
      // components without a local env simply have nothing to cache
      return [];
    }
  }
}

/**
 * the cache hierarchy as a flat map of raw secret variable names
 * (null values = recorded misses)
 */
const flattenSecrets = (
  secrets: CachedSecrets,
): Record<string, string | null> =>
  Object.fromEntries(
    Object.entries(secrets).flatMap(([env, components]) =>
      Object.entries(components).flatMap(([componentName, values]) =>
        Object.entries(values).map(([key, value]) => [
          getSecretVarName(env, componentName, key),
          value,
        ]),
      ),
    ),
  );

/**
 * only actual values — recorded misses stay unresolved, like any other
 * unset variable
 */
const withoutMisses = (
  known: Record<string, string | null>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(known).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    ),
  );
