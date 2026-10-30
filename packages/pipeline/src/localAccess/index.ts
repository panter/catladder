import { getAllEnvs } from "../config/configruedEnvs";
import { getEnvConfig } from "../context/getEnvConfig";
import { getEnvType } from "../context/getEnvType";
import { isOfDeployType } from "../deploy/types";
import type { Config, LocalAccessConfig, LocalAccessGcpPreset } from "../types";

export const LOCAL_ACCESS_GCP_PRESETS: Record<LocalAccessGcpPreset, string[]> =
  {
    // no run.viewer on purpose, see LocalAccessGcpPreset
    logs: ["roles/logging.viewer"],
    // not read-only, see LocalAccessGcpPreset; only reachable as a
    // preset, getDeniedLocalAccessRoleReason rejects it in `roles`
    vertex: ["roles/aiplatform.user"],
  };

/** name prefix of the service account `project setup` creates (see getGcloudServiceAccountNames) */
export const LOCAL_ACCESS_GCP_SA_NAME = "local-diag";

const ROLE_FORMAT =
  /^(roles\/[A-Za-z0-9_.]+|projects\/[a-z0-9-]+\/roles\/[A-Za-z0-9_.]+|organizations\/\d+\/roles\/[A-Za-z0-9_.]+)$/;

/**
 * roles that are read-only on paper but expose secrets: cloud run
 * services/jobs carry their secrets as plain env vars, so anything that
 * may read them reads every deployed secret. Denied even with
 * `allowAnyRole`.
 */
const SECRET_EXPOSING_ROLES: Record<string, string> = {
  "roles/viewer": "roles/viewer can read cloud run env vars (secrets)",
  "roles/run.viewer": "roles/run.viewer can read cloud run env vars (secrets)",
  "roles/secretmanager.secretAccessor": "this role reads secret values",
  "roles/secretmanager.admin": "this role reads secret values",
};

/**
 * roles granted without `allowAnyRole`. An explicit list instead of a
 * name pattern: a role called `*.viewer` / `*.reader` says nothing about
 * its permissions (custom roles can hold anything, and predefined ones
 * like storage.objectViewer, cloudfunctions.viewer, compute.viewer or
 * logging.privateLogViewer expose data or secrets).
 */
const SAFE_ROLES = [
  "roles/logging.viewer",
  "roles/monitoring.viewer",
  "roles/errorreporting.viewer",
];

/** `roles/foo.bar.v1` -> `foo.bar` (version suffixes must not defeat the checks) */
const getRoleName = (role: string) =>
  (role.split("/").pop() ?? role).replace(/(\.v\d+)+$/i, "");

/**
 * why a role may not be granted for local access, or undefined if it
 * is acceptable.
 *
 * By default only the roles in {@link SAFE_ROLES} pass; custom roles
 * and everything else need `allowAnyRole`. `allowAnyRole` lifts the
 * allow-list, but the obvious write/admin/impersonation roles and the
 * secret exposing roles stay denied.
 */
export const getDeniedLocalAccessRoleReason = (
  role: string,
  options: { allowAnyRole?: boolean } = {},
): string | undefined => {
  const secretReason = SECRET_EXPOSING_ROLES[role];
  if (secretReason) return secretReason;

  const name = getRoleName(role);
  if (name === "owner" || name === "editor") {
    return "owner/editor are full write roles";
  }
  const last = name.split(".").pop() ?? name;
  if (/admin$/i.test(last)) {
    return "admin roles can change resources";
  }
  if (
    /(editor|developer|writer|creator|deployer|invoker|builder|publisher|client|user|objectUser)$/i.test(
      last,
    ) &&
    !/^iam\./.test(name)
  ) {
    return "this role can change resources";
  }
  if (
    /^iam\./.test(name) &&
    /(serviceAccountUser|serviceAccountTokenCreator|serviceAccountKeyAdmin|workloadIdentityUser)$/.test(
      name,
    )
  ) {
    return "this role allows impersonating service accounts";
  }
  if (!options.allowAnyRole && !SAFE_ROLES.includes(role)) {
    return `only these roles are allowed: ${SAFE_ROLES.join(", ")} (set allowAnyRole: true to grant others at your own risk)`;
  }
  return undefined;
};

/**
 * the effective local access declaration of an env: the env's own
 * declaration replaces the project default entirely
 */
export const getLocalAccessConfig = (
  config: Pick<Config, "localAccess" | "environments">,
  env: string,
): Exclude<LocalAccessConfig, false> | undefined => {
  if (env === "local") return undefined;
  const envEntry = config.environments?.[env];
  const declared =
    envEntry && envEntry.localAccess !== undefined
      ? envEntry.localAccess
      : config.localAccess;
  return declared || undefined;
};

/** granted for the read-only db access, to connect through the cloud sql proxy */
export const LOCAL_ACCESS_DB_GCP_ROLE = "roles/cloudsql.client";

/** name of the postgres role `project setup` creates for the read-only db access */
export const LOCAL_ACCESS_DB_ROLE_NAME = "catladder_readonly";

/** local port the generated db env file points at (the cloud sql proxy has to listen there) */
export const LOCAL_ACCESS_DB_LOCAL_PORT = 54330;

/**
 * the db access declared for `env`: `"readonly"` or undefined.
 *
 * `prod` envs (by type) only get it when the declaration says
 * `allowProd: true`. The project default silently skips them (it is
 * meant for dev/review), an env's own declaration without `allowProd`
 * throws, since it can only be a mistake.
 */
export const getLocalAccessDb = (
  config: Pick<Config, "localAccess" | "environments">,
  env: string,
): "readonly" | undefined => {
  const db = getLocalAccessConfig(config, env)?.db;
  if (!db) return undefined;
  const { mode, allowProd } =
    typeof db === "string" ? { mode: db, allowProd: false } : db;
  if (mode !== "readonly") {
    throw new Error(
      `localAccess (${env}): unknown db mode '${mode}', known: readonly`,
    );
  }
  if (getEnvType(env, {}, config.environments) === "prod" && !allowProd) {
    const own = config.environments?.[env];
    if (own && own.localAccess !== undefined) {
      throw new Error(
        `localAccess (${env}): db access is not allowed for prod envs unless declared with allowProd: db: { mode: "readonly", allowProd: true }`,
      );
    }
    return undefined;
  }
  return mode;
};

/**
 * the gcp roles local access grants in `env`: preset roles plus the
 * explicit ones (plus the cloud sql client role for the db access),
 * deduplicated and sorted. Throws on an unknown preset,
 * a malformed role or a denied (write/admin) role.
 */
export const getLocalAccessGcpRoles = (
  config: Pick<Config, "localAccess" | "environments">,
  env: string,
): string[] => {
  const roles = new Set<string>();
  // the read-only db access reaches the instance through the proxy,
  // which needs the client role (not accepted in `roles`, see
  // getDeniedLocalAccessRoleReason)
  if (getLocalAccessDb(config, env)) roles.add(LOCAL_ACCESS_DB_GCP_ROLE);

  const gcp = getLocalAccessConfig(config, env)?.gcp;
  if (!gcp) return [...roles].sort();

  for (const preset of gcp.presets ?? []) {
    const presetRoles = LOCAL_ACCESS_GCP_PRESETS[preset];
    if (!presetRoles) {
      throw new Error(
        `localAccess (${env}): unknown gcp preset '${preset}', known: ${Object.keys(LOCAL_ACCESS_GCP_PRESETS).join(", ")}`,
      );
    }
    presetRoles.forEach((role) => roles.add(role));
  }
  for (const role of gcp.roles ?? []) {
    if (!ROLE_FORMAT.test(role)) {
      throw new Error(
        `localAccess (${env}): '${role}' is not a valid role (expected e.g. roles/logging.viewer)`,
      );
    }
    const reason = getDeniedLocalAccessRoleReason(role, {
      allowAnyRole: gcp.allowAnyRole,
    });
    if (reason) {
      throw new Error(
        `localAccess (${env}): role '${role}' is not allowed (${reason})`,
      );
    }
    roles.add(role);
  }
  return [...roles].sort();
};

/**
 * the envs of a component that declare gcp local access. Empty for
 * components that do not deploy to google cloud run.
 */
export const getLocalAccessGcpEnvs = (
  config: Config,
  componentName: string,
): string[] =>
  getAllEnvs(config, componentName).filter(
    (env) =>
      // only google cloud run envs have a project to grant roles in; the
      // env's own `deploy` overrides the component's
      isOfDeployType(
        getEnvConfig(config, componentName, env).deploy,
        "google-cloudrun",
      ) && getLocalAccessGcpRoles(config, env).length > 0,
  );

/**
 * name of the secret (stored under the `local` env of the component)
 * holding the service account key of `env`'s local access
 */
export const getLocalAccessGcpSecretName = (env: string) =>
  `LOCAL_ACCESS_GCP_${env.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_CREDENTIALS`;

/**
 * the envs of a component that declare read-only db access. Empty for
 * components that do not deploy to google cloud run with `cloudSql`.
 */
export const getLocalAccessDbEnvs = (
  config: Config,
  componentName: string,
): string[] =>
  getAllEnvs(config, componentName).filter((env) => {
    const deploy = getEnvConfig(config, componentName, env).deploy;
    return (
      isOfDeployType(deploy, "google-cloudrun") &&
      !!deploy.cloudSql &&
      !!getLocalAccessDb(config, env)
    );
  });

/**
 * name of the secret (stored under the `local` env of the component)
 * holding the read-only db credentials of `env` (json: user, password,
 * database, instanceConnectionName)
 */
export const getLocalAccessDbSecretName = (env: string) =>
  `LOCAL_ACCESS_DB_${env.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_CREDENTIALS`;

/**
 * the bindings to add and remove so that `current` matches `desired`.
 * The local access account is dedicated, so every binding it carries
 * beyond the declaration is extra.
 */
export const diffRoleBindings = (
  desired: string[],
  current: string[],
): { missing: string[]; extra: string[] } => ({
  missing: desired.filter((role) => !current.includes(role)),
  extra: current.filter((role) => !desired.includes(role)),
});

const ENV_VAR_NAME_FORMAT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * the extra env var names (`credentialsEnvVar`) under which the local
 * env of a component exports the key file path, mapped to the env whose
 * key they point at. Throws on a malformed name or on two envs
 * exporting the same name (e.g. a project default declaring it).
 */
export const getLocalAccessGcpCredentialsEnvVars = (
  config: Config,
  componentName: string,
): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const env of getLocalAccessGcpEnvs(config, componentName)) {
    const name = getLocalAccessConfig(config, env)?.gcp?.credentialsEnvVar;
    if (!name) continue;
    if (!ENV_VAR_NAME_FORMAT.test(name)) {
      throw new Error(
        `localAccess (${env}): credentialsEnvVar '${name}' is not a valid env var name`,
      );
    }
    if (vars[name]) {
      throw new Error(
        `localAccess (${componentName}): credentialsEnvVar '${name}' is declared by both ${vars[name]} and ${env}; declare it in one env only (environments.<env>.localAccess)`,
      );
    }
    vars[name] = env;
  }
  return vars;
};
