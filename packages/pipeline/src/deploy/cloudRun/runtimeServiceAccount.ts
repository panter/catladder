import type { ComponentContext } from "../../types/context";
import type {
  DeployConfigCloudRun,
  DeployConfigCloudRunManagedRuntimeServiceAccount,
  DeployConfigCloudRunVolumes,
} from "../types/googleCloudRun";
import { getGcloudServiceAccountNames } from "./utils/serviceAccountNames";

/** name prefix of the catladder-managed runtime service account */
export const CLOUD_RUN_RUNTIME_SA_NAME = "cl-r";

type RuntimeServiceAccountConfig = Pick<
  DeployConfigCloudRun,
  | "runtimeServiceAccount"
  | "projectId"
  | "cloudSql"
  | "service"
  | "additionalServices"
  | "jobs"
  | "workerPools"
>;

/**
 * the managed runtime service account spec, or null when the component
 * runs as the default compute account or an externally managed one
 */
export const getManagedRuntimeServiceAccount = (
  config: Pick<DeployConfigCloudRun, "runtimeServiceAccount">,
): DeployConfigCloudRunManagedRuntimeServiceAccount | null => {
  const sa = config.runtimeServiceAccount;
  if (sa === true) return {};
  if (typeof sa === "object" && sa !== null) return sa;
  return null;
};

/**
 * project-level roles of the managed runtime service account: the ones
 * the config implies plus the configured ones. Shared by `project setup`
 * (binds them) and `project doctor` (checks them).
 */
export const getRuntimeServiceAccountRoles = (
  config: RuntimeServiceAccountConfig,
): string[] => {
  const managed = getManagedRuntimeServiceAccount(config);
  if (!managed) return [];
  return unique([
    ...(config.cloudSql ? ["roles/cloudsql.client"] : []),
    ...(managed.roles ?? []),
  ]);
};

/**
 * bucket-level roles of the managed runtime service account, keyed by
 * bucket: the configured `bucketRoles` plus object access for every
 * cloud storage volume (cloud run mounts them as the runtime identity)
 */
export const getRuntimeServiceAccountBucketRoles = (
  config: RuntimeServiceAccountConfig,
): Record<string, string[]> => {
  const managed = getManagedRuntimeServiceAccount(config);
  if (!managed) return {};
  const result: Record<string, string[]> = {};
  const add = (bucket: string, roles: string[]) => {
    result[bucket] = unique([...(result[bucket] ?? []), ...roles]);
  };
  for (const volumes of getAllVolumes(config)) {
    for (const volume of Object.values(volumes)) {
      // buckets referencing env vars can't be resolved at setup time
      if (volume.type !== "cloud-storage" || volume.bucket.includes("$")) {
        continue;
      }
      add(volume.bucket, [
        volume.readonly
          ? "roles/storage.objectViewer"
          : "roles/storage.objectUser",
      ]);
    }
  }
  for (const [bucket, roles] of Object.entries(managed.bucketRoles ?? {})) {
    add(bucket, roles);
  }
  return result;
};

/**
 * email of the catladder-managed runtime service account of the given
 * component/env (whether or not the config enables it)
 */
export const getManagedRuntimeServiceAccountEmail = (
  context: Pick<ComponentContext, "env" | "name" | "fullConfig">,
  projectId: string,
) =>
  getGcloudServiceAccountNames(context, {
    name: CLOUD_RUN_RUNTIME_SA_NAME,
    projectId,
  }).fullIdentifier;

/**
 * the `--service-account` a service, job or worker pool is deployed with,
 * or undefined to leave it to cloud run (default compute account)
 */
export const getRuntimeServiceAccountEmail = (
  context: ComponentContext,
  config: RuntimeServiceAccountConfig,
  override?: string,
): string | undefined => {
  if (override) return override;
  const sa = config.runtimeServiceAccount;
  if (typeof sa === "string") return sa;
  if (getManagedRuntimeServiceAccount(config)) {
    return getManagedRuntimeServiceAccountEmail(context, config.projectId);
  }
  return undefined;
};

const getAllVolumes = (
  config: RuntimeServiceAccountConfig,
): DeployConfigCloudRunVolumes[] =>
  [
    typeof config.service === "object" ? config.service : null,
    ...Object.values(config.additionalServices ?? {}),
    ...Object.values(config.jobs ?? {}),
    ...Object.values(config.workerPools ?? {}),
  ].flatMap((entry) => (entry && entry.volumes ? [entry.volumes] : []));

const unique = (values: string[]) => [...new Set(values)];
