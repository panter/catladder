import type { Config } from "@catladder/pipeline";
import {
  getLocalAccessGcpSecretName,
  getSecretVarName,
} from "@catladder/pipeline";
import { mkdir, readdir, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { IO } from "../core/types";
import { writePrivateFile } from "../utils/writePrivateFile";
import { getDeclaredLocalAccessEnvs } from "./declared";
import { getProjectRootPath } from "../git/gitProjectInformation";

const sanitize = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_");

/** file name of a component/env key, relative to the local access folder */
export const getLocalAccessKeyFileName = (env: string, componentName: string) =>
  `gcp-${sanitize(env)}-${sanitize(componentName)}.json`;

/**
 * env var exposing the key file path. Deliberately NOT
 * GOOGLE_APPLICATION_CREDENTIALS: the key must only be used where a
 * command opts in (isolated gcloud config), never by ADC.
 */
export const getLocalAccessKeyFileVarName = (env: string) =>
  `CATLADDER_LOCAL_ACCESS_GCP_${sanitize(env).toUpperCase()}_KEY_FILE`;

// inside .catladder/, which ignores itself (see vault/cache.ts)
const getFolder = async () =>
  join(await getProjectRootPath(), ".catladder", "local-access");

/**
 * env vars pointing at the key files that exist for the component
 * (only paths, no secrets)
 */
export const getLocalAccessKeyFileVars = async (
  config: Config,
  componentName: string,
): Promise<Record<string, string>> => {
  const folder = await getFolder();
  return Object.fromEntries(
    getDeclaredLocalAccessEnvs(config, componentName)
      .map((env): [string, string] => [
        getLocalAccessKeyFileVarName(env),
        join(folder, getLocalAccessKeyFileName(env, componentName)),
      ])
      .filter(([, path]) => existsSync(path)),
  );
};

/**
 * writes the stored local access service account keys to gitignored
 * files (mode 0600) and removes files of declarations that are gone.
 * A no-op without any declaration (nothing is created). Never throws:
 * a vault that cannot be reached or an invalid declaration (reported by
 * `project doctor`) must not break catenv.
 *
 * The key is only read through the cache; if setup rotated it on another
 * machine, refresh with `catenv --vault-mode refresh`.
 */
export const writeLocalAccessKeyFiles = async (io: IO, config: Config) => {
  const wanted = Object.keys(config.components).flatMap((componentName) =>
    getDeclaredLocalAccessEnvs(config, componentName).map((env) => ({
      env,
      componentName,
      secretName: getSecretVarName(
        "local",
        componentName,
        getLocalAccessGcpSecretName(env),
      ),
      fileName: getLocalAccessKeyFileName(env, componentName),
    })),
  );

  const folder = await getFolder();
  if (wanted.length === 0 && !existsSync(folder)) return;

  try {
    const secrets =
      wanted.length > 0
        ? await (
            await io.getVaultManager()
          ).readSecrets(
            wanted.map((w) => w.secretName),
            io,
          )
        : {};
    await mkdir(folder, { recursive: true, mode: 0o700 });
    // the parent folder ignores itself
    await writeFile(join(folder, "..", ".gitignore"), "*\n");

    const written = new Set<string>();
    for (const { secretName, fileName, env, componentName } of wanted) {
      const key = secrets[secretName];
      if (!key) {
        io.log(
          `⚠️ no local access key for ${env}:${componentName} in the secret store — run \`catladder project setup\` (or \`catenv --vault-mode refresh\` if it was set up on another machine)`,
        );
        continue;
      }
      const path = join(folder, fileName);
      await writePrivateFile(path, key);
      written.add(fileName);
    }

    for (const file of await readdir(folder)) {
      if (!written.has(file)) {
        await rm(join(folder, file), { force: true });
      }
    }
  } catch (e) {
    io.log(`⚠️ could not write local access keys: ${e.message}`);
  }
};
