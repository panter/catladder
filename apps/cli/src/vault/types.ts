import type { IO } from "../core/types";

/**
 * a secrets vault is the readable source of truth for secret values.
 * CI backends (gitlab variables, github secrets) only receive mirrored
 * copies of what is stored here.
 */
export type SecretsVault = {
  /**
   * identity of the vault (incl. its config), used to invalidate the
   * local cache when the vault changes
   */
  id: string;

  /**
   * all secrets as a flat map of raw secret variable names
   * (CL_<ENV>_<COMPONENT>_<KEY>) to values
   */
  readAllSecrets(io: IO | null): Promise<Record<string, string>>;

  /**
   * upserts the secrets of one env and component
   * (keys as declared in the config, not the raw variable names).
   * Upsert, not replace: values that are not part of `secrets` stay
   * untouched.
   */
  writeSecrets(
    io: IO,
    env: string,
    componentName: string,
    secrets: Record<string, unknown>,
    options?: WriteSecretsOptions,
  ): Promise<void>;
};

export type WriteSecretsOptions = {
  /**
   * keep the previous value around where the store supports it (the
   * gitlab store writes `<KEY>_backup_<timestamp>` variables) —
   * a hand-written secret's only undo.
   *
   * Machine-provisioned credentials (service account keys, kubernetes
   * tokens) are regenerated on demand and their old value is worthless,
   * so `project setup` writes them with `backup: false`.
   */
  backup?: boolean;
};

/**
 * how secret resolution may interact with the vault:
 * - auto (default): contact the vault when the local cache is
 *   incomplete, prompting to unlock if necessary
 * - no-prompt: contact the vault only if that needs no interaction;
 *   fail on missing secrets instead of prompting to unlock
 * - offline: never contact the vault, use only the local cache
 * - refresh: ignore the local cache once and refresh it from the vault
 */
export type SecretsMode = "auto" | "no-prompt" | "offline" | "refresh";
