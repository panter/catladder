import type { Config } from "@catladder/pipeline";
import {
  getLocalAccessDbSecretName,
  getLocalAccessGcpSecretName,
  getSecretVarName,
  LOCAL_ACCESS_DB_LOCAL_PORT,
} from "@catladder/pipeline";
import { mkdir, readdir, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { IO } from "../core/types";
import { writePrivateFile } from "../utils/writePrivateFile";
import {
  getDeclaredLocalAccessCredentialsEnvVars,
  getDeclaredLocalAccessDbEnvs,
  getDeclaredLocalAccessEnvs,
} from "./declared";
import { getProjectRootPath } from "../git/gitProjectInformation";

const sanitize = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_");

/** file name of a component/env key, relative to the local access folder */
export const getLocalAccessKeyFileName = (env: string, componentName: string) =>
  `gcp-${sanitize(env)}-${sanitize(componentName)}.json`;

/**
 * env var exposing the key file path. Deliberately NOT
 * GOOGLE_APPLICATION_CREDENTIALS: the key must only be used where a
 * command opts in (isolated gcloud config, or a declared
 * `credentialsEnvVar`), never by ADC implicitly.
 */
export const getLocalAccessKeyFileVarName = (env: string) =>
  `CATLADDER_LOCAL_ACCESS_GCP_${sanitize(env).toUpperCase()}_KEY_FILE`;

/** file name of the read-only db connection of a component/env */
export const getLocalAccessDbFileName = (env: string, componentName: string) =>
  `db-${sanitize(env)}-${sanitize(componentName)}.env`;

/** env var exposing the path of the read-only db connection file */
export const getLocalAccessDbFileVarName = (env: string) =>
  `CATLADDER_LOCAL_ACCESS_DB_${sanitize(env).toUpperCase()}_ENV_FILE`;

/**
 * content of the db connection file (dotenv / libpq variables). The
 * cloud sql proxy is not started by catenv: run it on
 * {@link LOCAL_ACCESS_DB_LOCAL_PORT} with the env's key file, e.g.
 * `cloud-sql-proxy --credentials-file $CATLADDER_LOCAL_ACCESS_GCP_<ENV>_KEY_FILE
 * --port 54330 $CLOUD_SQL_INSTANCE_CONNECTION_NAME`.
 */
export const renderLocalAccessDbEnvFile = (raw: string): string => {
  const { user, password, database, instanceConnectionName } = JSON.parse(raw);
  const port = LOCAL_ACCESS_DB_LOCAL_PORT;
  return [
    `CLOUD_SQL_INSTANCE_CONNECTION_NAME="${instanceConnectionName}"`,
    `PGHOST="localhost"`,
    `PGPORT="${port}"`,
    `PGUSER="${user}"`,
    `PGPASSWORD="${password}"`,
    `PGDATABASE="${database}"`,
    `DATABASE_URL="postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:${port}/${encodeURIComponent(database)}"`,
    "",
  ].join("\n");
};

// inside .catladder/, which ignores itself (see vault/cache.ts)
const getFolder = async () =>
  join(await getProjectRootPath(), ".catladder", "local-access");

/**
 * env vars pointing at the key files that exist for the component
 * (only paths, no secrets): one per env, plus the declared
 * `credentialsEnvVar` names
 */
export const getLocalAccessKeyFileVars = async (
  config: Config,
  componentName: string,
): Promise<Record<string, string>> => {
  const folder = await getFolder();
  const getPath = (env: string) =>
    join(folder, getLocalAccessKeyFileName(env, componentName));
  return Object.fromEntries(
    [
      ...getDeclaredLocalAccessDbEnvs(config, componentName).map(
        (env): [string, string] => [
          getLocalAccessDbFileVarName(env),
          join(folder, getLocalAccessDbFileName(env, componentName)),
        ],
      ),
      ...getDeclaredLocalAccessEnvs(config, componentName).map(
        (env): [string, string] => [
          getLocalAccessKeyFileVarName(env),
          getPath(env),
        ],
      ),
      ...Object.entries(
        getDeclaredLocalAccessCredentialsEnvVars(config, componentName),
      ).map(([name, env]): [string, string] => [name, getPath(env)]),
    ].filter(([, path]) => existsSync(path)),
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
  const components = Object.keys(config.components);
  const wanted = components.flatMap((componentName) =>
    getDeclaredLocalAccessEnvs(config, componentName).map((env) => ({
      env,
      componentName,
      secretName: getSecretVarName(
        "local",
        componentName,
        getLocalAccessGcpSecretName(env),
      ),
      fileName: getLocalAccessKeyFileName(env, componentName),
      render: (secret: string) => secret,
      what: "key",
    })),
  );
  const wantedDb = components.flatMap((componentName) =>
    getDeclaredLocalAccessDbEnvs(config, componentName).map((env) => ({
      env,
      componentName,
      secretName: getSecretVarName(
        "local",
        componentName,
        getLocalAccessDbSecretName(env),
      ),
      fileName: getLocalAccessDbFileName(env, componentName),
      render: renderLocalAccessDbEnvFile,
      what: "db credentials",
    })),
  );
  const all = [...wanted, ...wantedDb];

  const folder = await getFolder();
  if (all.length === 0 && !existsSync(folder)) return;

  try {
    const secrets =
      all.length > 0
        ? await (
            await io.getVaultManager()
          ).readSecrets(
            all.map((w) => w.secretName),
            io,
          )
        : {};
    await mkdir(folder, { recursive: true, mode: 0o700 });
    // the parent folder ignores itself
    await writeFile(join(folder, "..", ".gitignore"), "*\n");

    const written = new Set<string>();
    for (const {
      secretName,
      fileName,
      env,
      componentName,
      render,
      what,
    } of all) {
      const secret = secrets[secretName];
      if (!secret) {
        io.log(
          `⚠️ no local access ${what} for ${env}:${componentName} in the secret store — run \`catladder project setup\` (or \`catenv --vault-mode refresh\` if it was set up on another machine)`,
        );
        continue;
      }
      const path = join(folder, fileName);
      await writePrivateFile(path, render(secret));
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
