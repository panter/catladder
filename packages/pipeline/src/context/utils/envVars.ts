import { isObject } from "lodash-es";
import type { SecretEnvVar } from "../getEnvironmentVariables";
import { getSecretVarName } from "../getEnvironmentVariables";
import { getBashVariable } from "@catladder/bash";
import type { EnvVars } from "../../types/config";
import type { DeployConfig } from "../../deploy/types";

export const stringifyValues = (obj: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      isObject(value) ? JSON.stringify(value) : `${value}`,
    ]),
  );

export const stringListToSecreteEnvVarList = (keys: string[]): SecretEnvVar[] =>
  keys.map((key) => ({ key }));

/**
 * normalizes both config forms of vault-stored env vars: the deprecated
 * plain string[] (all keys secret) and the record form carrying a kind
 * (or config object) per key
 */
export const normalizeSecretVarsConfig = (
  secret: EnvVars["secret"],
): SecretEnvVar[] => {
  if (!secret) {
    return [];
  }
  if (Array.isArray(secret)) {
    return stringListToSecreteEnvVarList(secret);
  }
  return Object.entries(secret).map(([key, config]) =>
    typeof config === "string" ? { key, kind: config } : { key, ...config },
  );
};
export const makeSecretEnvVarMapping = (
  env: string,
  componentName: string,
  secretEnvVars: SecretEnvVar[],
) => {
  return Object.fromEntries(
    secretEnvVars.map(({ key }) => [
      key,
      getBashVariable(getSecretVarName(env, componentName, key)),
    ]),
  );
};

/**
 * whether the deploy delivers runtime secrets to the app without CI
 * variables (e.g. Cloud Run --set-secrets). No deploy type does today,
 * so runtime-only secrets are still mirrored to CI. Flip per type in
 * cat-92k.7.
 */
export const deliversRuntimeSecretsOutsideCi = (
  _deploy: DeployConfig | false | undefined,
): boolean => false;

/**
 * whether a secret must be available as a CI variable. Only secrets
 * scoped to a subset of runtime/local can be skipped, and only if the
 * runtime gets them elsewhere.
 */
export const secretNeedsCiDelivery = (
  secret: Pick<SecretEnvVar, "scopes">,
  opts: { runtimeSecretsOutsideCi: boolean },
): boolean => {
  const { scopes } = secret;
  if (!scopes || scopes.length === 0) {
    return true;
  }
  if (scopes.some((s) => s === "build" || s === "deploy" || s === "jobs")) {
    return true;
  }
  return !opts.runtimeSecretsOutsideCi;
};
