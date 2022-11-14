import { isObject, merge } from "lodash";
import { DEPLOY_TYPES } from "../deploy";
import type { CommitInfo, Context } from "../types";
import type { Config, DevLocalEnvConfig } from "../types/config";

import { getEnvironmentContext } from "./getEnvironmentContext";
import {
  resolveReferences,
  translateLegacyFromComponents,
} from "./resolveReferences";

export const getEnvironmentVariables = async (
  config: Config,
  componentName: string,
  env: string,
  commitInfo?: CommitInfo,
  alreadyVisited: Record<string, Record<string, boolean>> = {} // to prevent endless loop
): Promise<{
  envVars: Record<string, string>;
  secretEnvVarKeys: string[];
  host: string;
  url: string;
}> => {
  const environmentContext = getEnvironmentContext(
    config,
    env,
    componentName,
    commitInfo
  );

  const { envConfigRaw, deployConfigRaw, envType } = environmentContext;

  const basePredefinedVariables = {
    ENV_SHORT: env,
    APP_DIR: envConfigRaw.dir,
    ENV_TYPE: envType,
  };

  let predefinedVariables: Record<string, string>;
  let host: string;
  let url: string;

  if (envType === "local") {
    const devLocalConfig: DevLocalEnvConfig = envConfigRaw;
    const port = devLocalConfig.port ?? 3000;
    host = "localhost:" + port;
    url = "http://" + host;
    predefinedVariables = {
      ENV_SHORT: "local",
      ROOT_URL: url,
      PORT: port.toString(),
    };
  } else {
    const additionalEnvVars = deployConfigRaw
      ? DEPLOY_TYPES[deployConfigRaw.type].getAdditionalEnvVars(
          environmentContext
        )
      : {};

    host =
      envConfigRaw?.host ??
      additionalEnvVars.HOST_CANONICAL ??
      "unknown-host.example.com";
    url = `https://${host}`;

    predefinedVariables = {
      ...basePredefinedVariables,
      HOST: host,
      ROOT_URL: url,
      ...additionalEnvVars,
    };
  }
  const publicEnvVarsRaw = envConfigRaw.vars?.public ?? {};

  const additionalSecretKeys = deployConfigRaw
    ? DEPLOY_TYPES[deployConfigRaw.type].additionalSecretKeys(
        environmentContext
      )
    : [];

  const secretEnvVarKeys = [
    ...(envConfigRaw.vars?.secret ?? []),
    ...additionalSecretKeys,
  ];
  const secretEnvVars = Object.fromEntries(
    secretEnvVarKeys.map((key) => [
      key,
      `$${getSecretVarName(env, componentName, key)}`,
    ])
  );

  // this is deprecated, we now support: $componentname:FOO
  const legacyFromComponents = envConfigRaw.vars?.fromComponents ?? {};
  const publicEnvVarsRawWithLegasyFromComponents = merge(
    {},
    translateLegacyFromComponents(legacyFromComponents),
    publicEnvVarsRaw
  );

  const publicEnvVarsRawSanitized = Object.fromEntries(
    Object.entries(publicEnvVarsRawWithLegasyFromComponents).map(
      ([key, value]) => [
        key,
        isObject(value) ? JSON.stringify(value) : `${value}`,
      ]
    )
  );

  const envVarsRaw = addIndexVar({
    ...predefinedVariables,
    ...secretEnvVars,
    ...publicEnvVarsRawSanitized,
  });

  const envVars = await resolveReferences(
    envVarsRaw,
    async (otherComponentName, variableName, alreadyVisited) => {
      const { envVars: otherEnvVars } = await getEnvironmentVariables(
        config,
        otherComponentName,
        env,
        commitInfo,
        alreadyVisited
      );
      return otherEnvVars[variableName];
    },
    alreadyVisited
  );

  return {
    envVars,
    secretEnvVarKeys,
    host,
    url,
  };
};

const sanitizeForEnVar = (s: string) => s.replace(/-/g, "_");

export const getSecretVarName = (
  env: string,
  componentName: string,
  key: string
) => `CL_${sanitizeForEnVar(env)}_${sanitizeForEnVar(componentName)}_${key}`; // remove dash from component name

const addIndexVar = (vars: Record<string, unknown>) => ({
  ...vars,
  _ALL_ENV_VAR_KEYS: JSON.stringify(Object.keys(vars)),
});

export const getSecretVarNameForContext = (context: Context, key: string) =>
  getSecretVarName(context.environment.shortName, context.componentName, key);
