import type { Config, SecretEnvVar } from "@catladder/pipeline";
import {
  deliversRuntimeSecretsOutsideCi,
  secretNeedsCiDelivery,
} from "@catladder/pipeline";
import { getEnvironment } from "../config/getProjectConfig";

export type CiDeliveryPartition = {
  /** secrets that must be mirrored to the CI backends */
  deliver: Record<string, unknown>;
  /** keys of runtime-only secrets that need no CI variable */
  skipped: string[];
  /** runtime-only secrets kept in CI because the deploy reads them there */
  keptRuntimeOnly: string[];
};

/**
 * splits the secrets of one env/component into those that must be
 * mirrored to CI and those that only the runtime needs. jobOnlyVars keys
 * and unknown keys are always delivered.
 */
export const partitionSecretsForCi = async (
  config: Config,
  env: string,
  componentName: string,
  secrets: Record<string, unknown>,
): Promise<CiDeliveryPartition> => {
  const environment = await getEnvironment(env, componentName);
  const scopesByKey = new Map<string, SecretEnvVar>(
    (environment.secretEnvVarKeys as SecretEnvVar[]).map((s) => [s.key, s]),
  );
  const outside = deliversRuntimeSecretsOutsideCi(
    config.components?.[componentName]?.deploy,
  );
  const deliver: Record<string, unknown> = {};
  const skipped: string[] = [];
  const keptRuntimeOnly: string[] = [];
  for (const [key, value] of Object.entries(secrets)) {
    const secret = scopesByKey.get(key);
    if (
      !secret ||
      secretNeedsCiDelivery(secret, { runtimeSecretsOutsideCi: outside })
    ) {
      deliver[key] = value;
      if (secret && isRuntimeOnly(secret)) {
        keptRuntimeOnly.push(key);
      }
    } else {
      skipped.push(key);
    }
  }
  return { deliver, skipped, keptRuntimeOnly };
};

const isRuntimeOnly = (secret: Pick<SecretEnvVar, "scopes">) =>
  !!secret.scopes?.length &&
  secret.scopes.every((s) => s === "runtime" || s === "local");
