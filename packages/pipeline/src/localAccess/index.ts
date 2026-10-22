import { getAllEnvs } from "../config/configruedEnvs";
import { isOfDeployType } from "../deploy/types";
import type { Config, LocalAccessConfig, LocalAccessGcpPreset } from "../types";

export const LOCAL_ACCESS_GCP_PRESETS: Record<LocalAccessGcpPreset, string[]> =
  {
    // no run.viewer on purpose, see LocalAccessGcpPreset
    logs: ["roles/logging.viewer"],
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

/** `roles/foo.bar.v1` -> `foo.bar` (version suffixes must not defeat the checks) */
const getRoleName = (role: string) =>
  (role.split("/").pop() ?? role).replace(/(\.v\d+)+$/i, "");

/**
 * why a role may not be granted for local access, or undefined if it
 * is acceptable.
 *
 * By default only an allow-list passes: roles named `*.viewer` or
 * `*.reader` (minus the secret exposing ones). `allowAnyRole` lifts the
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
  if (!options.allowAnyRole && !/\.(viewer|reader)$/i.test(name)) {
    return "only *.viewer / *.reader roles are allowed (set allowAnyRole: true to grant others at your own risk)";
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

/**
 * the gcp roles local access grants in `env`: preset roles plus the
 * explicit ones, deduplicated and sorted. Throws on an unknown preset,
 * a malformed role or a denied (write/admin) role.
 */
export const getLocalAccessGcpRoles = (
  config: Pick<Config, "localAccess" | "environments">,
  env: string,
): string[] => {
  const gcp = getLocalAccessConfig(config, env)?.gcp;
  if (!gcp) return [];

  const roles = new Set<string>();
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
  // only google cloud run components have a project to grant roles in
  isOfDeployType(config.components[componentName]?.deploy, "google-cloudrun")
    ? getAllEnvs(config, componentName).filter(
        (env) => getLocalAccessGcpRoles(config, env).length > 0,
      )
    : [];

/**
 * name of the secret (stored under the `local` env of the component)
 * holding the service account key of `env`'s local access
 */
export const getLocalAccessGcpSecretName = (env: string) =>
  `LOCAL_ACCESS_GCP_${env.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_CREDENTIALS`;

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
