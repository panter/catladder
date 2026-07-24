import { isObject } from "lodash-es";
import type { SecretEnvVar } from "../getEnvironmentVariables";
import { getSecretVarName } from "../getEnvironmentVariables";
import { getBashVariable } from "@catladder/bash";
import type { EnvVars } from "../../types/config";

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
