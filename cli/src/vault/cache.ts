import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { getProjectRootPath } from "../git/gitProjectInformation";

/**
 * hierarchical: env -> componentName -> key -> value.
 * Only the "local" env is ever cached — other envs' secrets have no
 * business sitting on developer machines.
 *
 * `null` records a declared secret that was absent in the vault at the
 * last refresh (e.g. deploy credentials that intentionally don't exist
 * for local) — a known miss, so it doesn't force re-contacting the
 * vault on every run.
 */
export type CachedSecrets = {
  [env: string]: { [componentName: string]: { [key: string]: string | null } };
};

/**
 * local, project-scoped cache of the vault secrets, so that frequent
 * catenv runs don't have to contact the vault (e.g. unlock bitwarden)
 * every time. Plaintext — like the .env files catenv writes anyway —
 * but never committed (the folder ignores itself).
 */
type SecretsCache = {
  /** the vault this cache was filled from */
  vaultId: string;
  updatedAt: string;
  secrets: CachedSecrets;
};

const getCacheFolder = async () =>
  join(await getProjectRootPath(), ".catladder");

const getCachePath = async () => join(await getCacheFolder(), "secrets.json");

export const readSecretsCache = async (): Promise<SecretsCache | null> => {
  try {
    return JSON.parse(await readFile(await getCachePath(), "utf-8"));
  } catch {
    return null;
  }
};

export const writeSecretsCache = async (
  vaultId: string,
  secrets: CachedSecrets,
): Promise<void> => {
  const folder = await getCacheFolder();
  await mkdir(folder, { recursive: true });
  // the folder ignores itself, so the cache can never be committed
  await writeFile(join(folder, ".gitignore"), "*\n");
  const cache: SecretsCache = {
    vaultId,
    updatedAt: new Date().toISOString(),
    secrets,
  };
  await writeFile(await getCachePath(), JSON.stringify(cache, null, 2));
};

/**
 * merges freshly written secrets of one env/component into the cache
 * (write-through from config-secrets), so the next catenv run doesn't
 * need the vault
 */
export const updateSecretsCache = async (
  vaultId: string,
  env: string,
  componentName: string,
  values: Record<string, string>,
): Promise<void> => {
  const existing = await readSecretsCache();
  const secrets: CachedSecrets =
    existing?.vaultId === vaultId ? existing.secrets : {};
  secrets[env] = {
    ...secrets[env],
    [componentName]: { ...secrets[env]?.[componentName], ...values },
  };
  await writeSecretsCache(vaultId, secrets);
};
