import { getAllEnvs } from "../config/configruedEnvs";
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
 * why a role may not be granted for local access, or undefined if it
 * is acceptable. A deny list can never be complete — it only catches
 * the obvious write/admin roles; the rest is the user's responsibility.
 */
export const getDeniedLocalAccessRoleReason = (
  role: string,
): string | undefined => {
  const name = role.split("/").pop() ?? role;
  if (name === "owner" || name === "editor") {
    return "owner/editor are full write roles";
  }
  const last = name.split(".").pop() ?? name;
  if (/admin$/i.test(last)) {
    return "admin roles can change resources";
  }
  if (/(editor|developer|writer|creator|deployer|invoker)$/i.test(last)) {
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
    const reason = getDeniedLocalAccessRoleReason(role);
    if (reason) {
      throw new Error(
        `localAccess (${env}): role '${role}' is not allowed (${reason})`,
      );
    }
    roles.add(role);
  }
  return [...roles].sort();
};

/** the envs of a component that declare gcp local access */
export const getLocalAccessGcpEnvs = (
  config: Config,
  componentName: string,
): string[] =>
  getAllEnvs(config, componentName).filter(
    (env) => getLocalAccessGcpRoles(config, env).length > 0,
  );

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
