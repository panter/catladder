import type { ComponentContext } from "@catladder/pipeline";
import {
  getLocalAccessDbSecretName,
  getSecretVarName,
  LOCAL_ACCESS_DB_ROLE_NAME,
} from "@catladder/pipeline";
import { randomBytes } from "crypto";
import { spawn } from "child_process";
import { getEnvVarsResolved } from "../config/getProjectConfig";
import type { IO } from "../core/types";
import { startCloudSqlProxyInBackground } from "./cloudSql/startProxy";

/** local port of the proxy `project setup` starts, not the one catenv points at */
const SETUP_PROXY_PORT = 54331;

/** what is stored in the secret store, see getLocalAccessDbSecretName */
export type LocalAccessDbCredentials = {
  user: string;
  password: string;
  database: string;
  instanceConnectionName: string;
};

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;
const quoteLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

/**
 * sql making the read-only role of `database` match the declaration:
 * can log in and connect, SELECT on everything in the `public` schema
 * (also tables `appUser` creates later), nothing else — and every
 * session read-only. Idempotent, the password is (re)set on every run.
 */
export const buildReadonlyRoleSql = (opts: {
  role: string;
  password: string;
  database: string;
  appUser: string;
}): string => {
  const role = quoteIdent(opts.role);
  return [
    `DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${quoteLiteral(opts.role)}) THEN
    CREATE ROLE ${role} LOGIN;
  END IF;
END $$;`,
    `ALTER ROLE ${role} WITH LOGIN PASSWORD ${quoteLiteral(opts.password)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;`,
    `ALTER ROLE ${role} SET default_transaction_read_only = on;`,
    `GRANT CONNECT ON DATABASE ${quoteIdent(opts.database)} TO ${role};`,
    `GRANT USAGE ON SCHEMA public TO ${role};`,
    `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${role};`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(opts.appUser)} IN SCHEMA public GRANT SELECT ON TABLES TO ${role};`,
  ].join("\n");
};

/** sql removing the role and everything it was granted in `database` */
export const buildDropReadonlyRoleSql = (opts: {
  role: string;
  appUser: string;
}): string => {
  const role = quoteIdent(opts.role);
  return [
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(opts.appUser)} IN SCHEMA public REVOKE SELECT ON TABLES FROM ${role};`,
    `DROP OWNED BY ${role};`,
    `DROP ROLE IF EXISTS ${role};`,
  ].join("\n");
};

export const generateDbPassword = () => randomBytes(24).toString("hex");

/**
 * the db name of a context if it is the same on every deploy. Review
 * envs derive it from the merge request (`$CI_...` expressions), there
 * is no database to grant on before the review app exists.
 */
export const getStaticDbName = (dbName: unknown): string | undefined => {
  const value = dbName?.toString();
  return value && !value.includes("$") ? value : undefined;
};

const runPsql = (env: Record<string, string>, sql: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1"], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (e) =>
      reject(
        (e as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error("psql not installed")
          : e,
      ),
    );
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`psql failed (exit ${code}): ${stderr.trim()}`)),
    );
    child.stdin.end(sql);
  });

export type LocalAccessDbDeps = {
  runSql: (env: Record<string, string>, sql: string) => Promise<void>;
  withProxy: <T>(
    instanceName: string,
    port: number,
    fn: () => Promise<T>,
  ) => Promise<T>;
  getAppCredentials: (
    io: IO,
    context: ComponentContext,
  ) => Promise<{ user: string; password: string; database: unknown }>;
};

const defaultDeps: LocalAccessDbDeps = {
  runSql: runPsql,
  withProxy: async (instanceName, port, fn) => {
    const proxy = await startCloudSqlProxyInBackground({
      instanceName,
      localPort: port,
    });
    try {
      return await fn();
    } finally {
      proxy.stop();
    }
  },
  getAppCredentials: async (io, context) => {
    const envVars = await getEnvVarsResolved(io, context.env, context.name);
    return {
      user: envVars.DB_USER?.toString(),
      password: envVars.DB_PASSWORD?.toString(),
      database: context.environment.envVars.DB_NAME,
    };
  },
};

const parseStored = (raw: string | undefined) => {
  try {
    const parsed = JSON.parse(raw ?? "");
    return typeof parsed.password === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/**
 * brings the read-only database role of a component/env in line with
 * the declaration:
 *
 * - declared: the role exists with SELECT on the app database, its
 *   credentials are in the secret store (under the `local` env, never
 *   mirrored to ci). The stored password is kept, so re-running does
 *   not lock out other machines.
 * - not declared, but credentials are stored: the role is dropped. The
 *   credentials stay in the vault (like the service account key, see
 *   syncLocalAccessServiceAccount).
 *
 * Needs `psql` and the cloud sql proxy, and connects as the app user.
 */
export const syncLocalAccessDb = async (
  io: IO,
  context: ComponentContext,
  instanceConnectionName: string,
  declared: boolean,
  deps: LocalAccessDbDeps = defaultDeps,
): Promise<void> => {
  const secretName = getLocalAccessDbSecretName(context.env);
  const vaultManager = await io.getVaultManager();
  const rawName = getSecretVarName("local", context.name, secretName);
  // straight from the vault, not the local cache (see syncLocalAccessServiceAccount)
  const stored = parseStored(
    (await vaultManager.vault.readAllSecrets(io))[rawName],
  );
  if (!declared && !stored) return;

  const app = await deps.getAppCredentials(io, context);
  const database = getStaticDbName(app.database);
  if (!app.user || !app.password || !database) {
    if (declared) {
      io.log(
        `⚠️ ${context.env}:${context.name}: read-only db access skipped, the database name is not known before the deploy (review envs have one database per merge request)`,
      );
    }
    return;
  }

  const appEnv = {
    PGHOST: "localhost",
    PGPORT: String(SETUP_PROXY_PORT),
    PGUSER: app.user,
    PGPASSWORD: app.password,
    PGDATABASE: database,
  };

  if (!declared) {
    io.log(
      `db access no longer declared, dropping ${LOCAL_ACCESS_DB_ROLE_NAME}`,
    );
    await deps.withProxy(instanceConnectionName, SETUP_PROXY_PORT, () =>
      deps.runSql(
        appEnv,
        buildDropReadonlyRoleSql({
          role: LOCAL_ACCESS_DB_ROLE_NAME,
          appUser: app.user,
        }),
      ),
    );
    return;
  }

  const password = stored?.password ?? generateDbPassword();
  io.log(
    `sync read-only db role ${LOCAL_ACCESS_DB_ROLE_NAME} on ${database}...`,
  );
  await deps.withProxy(instanceConnectionName, SETUP_PROXY_PORT, () =>
    deps.runSql(
      appEnv,
      buildReadonlyRoleSql({
        role: LOCAL_ACCESS_DB_ROLE_NAME,
        password,
        database,
        appUser: app.user,
      }),
    ),
  );

  const credentials: LocalAccessDbCredentials = {
    user: LOCAL_ACCESS_DB_ROLE_NAME,
    password,
    database,
    instanceConnectionName,
  };
  const value = JSON.stringify(credentials);
  if (stored && JSON.stringify(stored) === value) {
    await vaultManager.cacheSecrets("local", context.name, {
      [secretName]: value,
    });
    return;
  }
  // straight into the vault, NOT through writeSecretsAndMirror: local use only
  await vaultManager.writeSecrets(
    "local",
    context.name,
    { [secretName]: value },
    io,
    { backup: false },
  );
};
