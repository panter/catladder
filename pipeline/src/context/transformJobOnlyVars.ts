import type { EnvironmentEnvVars } from "..";
import type { EnvVars } from "../types/config";
import {
  makeSecretEnvVarMapping,
  stringListToSecreteEnvVarList,
  stringifyValues,
} from "./utils/envVars";

/**
 * transform EnvVars for environment.
 *
 * currently does not resolve references and is only used for additional job-only-vars
 * @param vars
 * @returns
 */
export const transformJobOnlyVars = async (
  env: string,
  componentName: string,
  vars: EnvVars | null
): Promise<EnvironmentEnvVars> => {
  if (!vars) {
    return {
      envVars: {},
      secretEnvVarKeys: [],
    };
  }

  const publicVars = stringifyValues(vars?.public ?? {});
  const secretEnvVarKeys = stringListToSecreteEnvVarList(vars?.secret ?? []);
  const deployJobOnlySecretEnvVars = vars?.secret
    ? makeSecretEnvVarMapping(env, componentName, secretEnvVarKeys)
    : {};

  const envVars = {
    ...deployJobOnlySecretEnvVars,
    ...publicVars,
  };
  return {
    envVars,
    secretEnvVarKeys,
  };
};
