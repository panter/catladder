import { merge } from "lodash";
import { DEPLOY_TYPES } from "../deploy";
import type {
  CommitInfo,
  Context,
  EnvironmentEnvVarPart as EnvironmentVariables,
} from "../types";
import type { Config, DevLocalEnvConfig } from "../types/config";

import { getEnvironmentContext } from "./getEnvironmentContext";
import {
  resolveReferences,
  translateLegacyFromComponents,
} from "./resolveReferences";
import {
  stringListToSecreteEnvVarList,
  makeSecretEnvVarMapping,
  stringifyValues,
} from "./utils/envVars";
import { transformJobOnlyVars } from "./transformJobOnlyVars";

export type SecretEnvVar = {
  key: string;
  // hidden env vars are not shown in config-secrets
  hidden?: boolean;
};
export const getEnvironmentVariables = async (
  config: Config,
  componentName: string,
  env: string,
  commitInfo?: CommitInfo,
  alreadyVisited: Record<string, Record<string, boolean>> = {} // to prevent endless loop
): Promise<EnvironmentVariables> => {
  const environmentContext = getEnvironmentContext(
    config,
    env,
    componentName,
    commitInfo
  );

  const { envConfigRaw, deployConfigRaw, buildConfigRaw, envType } =
    environmentContext;

  const basePredefinedVariables = {
    ENV_SHORT: env,
    APP_DIR: envConfigRaw.dir,
    ENV_TYPE: envType,
    BUILD_INFO_ID: commitInfo?.buildId,
    BUILD_INFO_BUILD_TIME: commitInfo?.buildTime,
    BUILD_INFO_CURRENT_VERSION: commitInfo?.currentVersion,
  };

  let predefinedVariables: Record<string, string | undefined>;
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
      HOST_INTERNAL: host,
      ROOT_URL_INTERNAL: "http://" + host,
      PORT: port.toString(),
    };
  } else {
    const additionalEnvVars = deployConfigRaw
      ? DEPLOY_TYPES[deployConfigRaw.type].getAdditionalEnvVars(
          environmentContext as never
        )
      : {};
    const HOST_INTERNAL =
      additionalEnvVars.HOST_INTERNAL ?? "unknown-host.example.com";
    host = envConfigRaw?.host ?? HOST_INTERNAL;
    url = `https://${host}`;

    predefinedVariables = {
      ...basePredefinedVariables,
      // Rails before 6.1 (mis)uses the `HOST` environment variable to specify the IP to bind to
      ...(config.components[componentName].build.type === "rails"
        ? {}
        : { HOST: host }),
      ROOT_URL: url,
      HOST_CANONICAL: HOST_INTERNAL, // legacy
      ROOT_URL_INTERNAL: "https://" + HOST_INTERNAL,
      ...additionalEnvVars,
    };
  }
  const publicEnvVarsRaw = envConfigRaw.vars?.public ?? {};

  const additionalSecretKeys = deployConfigRaw
    ? DEPLOY_TYPES[deployConfigRaw.type].additionalSecretKeys(
        environmentContext as never
      )
    : [];

  const secretEnvVarKeys: SecretEnvVar[] = [
    ...stringListToSecreteEnvVarList(envConfigRaw.vars?.secret ?? []),
    ...additionalSecretKeys,
  ];
  const secretEnvVars = makeSecretEnvVarMapping(
    env,
    componentName,
    secretEnvVarKeys
  );
  // this is deprecated, we now support: $componentname:FOO
  const legacyFromComponents = envConfigRaw.vars?.fromComponents ?? {};
  const publicEnvVarsRawWithLegacyFromComponents = merge(
    {},
    translateLegacyFromComponents(legacyFromComponents),
    publicEnvVarsRaw
  );

  const publicEnvVarsRawSanitized = stringifyValues(
    publicEnvVarsRawWithLegacyFromComponents
  );

  const envVarsRaw = addIndexVar({
    ...predefinedVariables,
    ...secretEnvVars,
    ...publicEnvVarsRawSanitized,
  });

  const envVars = await resolveReferences(
    envVarsRaw,
    async (otherComponentName, alreadyVisited) => {
      const { envVars: otherEnvVars } = await getEnvironmentVariables(
        config,
        otherComponentName,
        env,
        commitInfo,
        alreadyVisited
      );
      return otherEnvVars;
    },
    alreadyVisited
  );

  return {
    envVars,
    secretEnvVarKeys,
    jobOnlyVars: {
      build: await transformJobOnlyVars(
        env,
        componentName,
        (buildConfigRaw && buildConfigRaw.jobVars) || null
      ),
      deploy: await transformJobOnlyVars(
        env,
        componentName,
        (deployConfigRaw && deployConfigRaw.jobVars) || null
      ),
    },

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
