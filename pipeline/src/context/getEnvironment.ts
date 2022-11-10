import { isObject, merge } from "lodash";
import type { EnvVarContext } from "../deploy";
import { DEPLOY_TYPES } from "../deploy";
import type { Config, DevLocalEnvConfig } from "../types/config";
import { isKnowEnvType } from "../types/config";
import type { CommitInfo, Context, Environment } from "../types/context";
import { mergeWithMergingArrays } from "../utils";
import {
  resolveReferences,
  translateLegacyFromComponents,
} from "./resolveReferences";

export const getEnvironment = async (
  config: Config,
  componentName: string,
  env: string,
  commitInfo?: CommitInfo,
  alreadyVisited: Record<string, Record<string, boolean>> = {} // to prevent endless loop
): Promise<Environment> => {
  const envConfig = getEnvConfig(config, componentName, env);
  // env type: if its set manually, use that, otherwise use the known env types
  const envType = envConfig?.type ?? (isKnowEnvType(env) ? env : null);

  if (!envType) {
    throw new Error(
      "Missing type in environment " + env + " in component " + componentName
    );
  }

  const basePredefinedVariables = {
    ENV_SHORT: env,
    APP_DIR: envConfig.dir,
    ENV_TYPE: envType,
  };

  const gitlabEnvironmentName =
    envType === "review" && commitInfo
      ? `${env}/${commitInfo.refName}/${componentName}`
      : `${env}/${componentName}`;

  const environmentSlug =
    envType === "review" && commitInfo
      ? `${env}-${commitInfo.reviewSlug}-${componentName}`
      : `${env}-${componentName}`;

  let predefinedVariables: Record<string, string>;
  let host: string;
  let url: string;
  const fullName = `${config.customerName}-${config.appName}-${environmentSlug}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envVarContext: EnvVarContext<any> = {
    deployConfig: envConfig.deploy,
    fullName,
    envType,
    commitInfo,
    componentName,
    env,
    fullConfig: config,
  };

  if (envType === "local") {
    const devLocalConfig: DevLocalEnvConfig = envConfig;
    const port = devLocalConfig.port ?? 3000;
    host = "localhost:" + port;
    url = "http://" + host;
    predefinedVariables = {
      ENV_SHORT: "local",
      ROOT_URL: url,
      PORT: port.toString(),
    };
  } else {
    const additionalEnvVars = envConfig.deploy
      ? DEPLOY_TYPES[envConfig.deploy.type].getAdditionalEnvVars(envVarContext)
      : {};

    host =
      envConfig?.host ??
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
  const publicEnvVarsRaw = envConfig.vars?.public ?? {};

  const additionalSecretKeys = envConfig.deploy
    ? DEPLOY_TYPES[envConfig.deploy.type].additionalSecretKeys(envVarContext)
    : [];

  const secretEnvVarKeys = [
    ...(envConfig.vars?.secret ?? []),
    ...additionalSecretKeys,
  ];
  const secretEnvVars = Object.fromEntries(
    secretEnvVarKeys.map((key) => [
      key,
      `$${getSecretVarName(env, componentName, key)}`,
    ])
  );

  // this is deprecated, we now support: $componentname:FOO
  const legacyFromComponents = envConfig.vars?.fromComponents ?? {};
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
    async (componentName, variableName, alreadyVisited) => {
      const { envVars } = await getEnvironment(
        config,
        componentName,
        env,
        commitInfo,
        alreadyVisited
      );
      return envVars[variableName];
    },
    alreadyVisited
  );
  return {
    envType,
    host,
    url,
    gitlabEnvironment: {
      name: gitlabEnvironmentName,
      url,
    },
    fullName,
    slug: environmentSlug,
    shortName: env,
    envVars,
    secretEnvVarKeys,
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

const getEnvConfig = (config: Config, componentName: string, env: string) => {
  const defaultConfig = config.components[componentName];
  if (!defaultConfig) {
    throw new Error("unknown component " + componentName);
  }

  const envCustomizations = defaultConfig.env?.[env] ?? {};
  if (envCustomizations === false) {
    throw new Error("env is disabled: " + env);
  }

  return mergeWithMergingArrays(defaultConfig, envCustomizations);
};
