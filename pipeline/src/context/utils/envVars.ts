import { isObject } from "lodash";
import type { SecretEnvVar } from "../getEnvironmentVariables";
import { getSecretVarName } from "../getEnvironmentVariables";

export const stringifyValues = (obj: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      isObject(value) ? JSON.stringify(value) : `${value}`,
    ])
  );

export const stringListToSecreteEnvVarList = (keys: string[]): SecretEnvVar[] =>
  keys.map((key) => ({ key }));
export const makeSecretEnvVarMapping = (
  env: string,
  componentName: string,
  secretEnvVars: SecretEnvVar[]
) => {
  return Object.fromEntries(
    secretEnvVars.map(({ key }) => [
      key,
      `$${getSecretVarName(env, componentName, key)}`,
    ])
  );
};
