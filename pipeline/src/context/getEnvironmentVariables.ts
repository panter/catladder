import { merge } from "lodash";
import { DEPLOY_TYPES } from "../deploy";
import type {
  ComponentContext,
  EnvironmentEnvVarPart as EnvironmentVariables,
} from "../types";
import type { DevLocalEnvConfig } from "../types/config";

import type { CreateComponentContextContext, UnspecifiedEnvVars } from "..";
import type { StringOrBashExpression } from "../bash/BashExpression";
import { joinBashExpressions } from "../bash/BashExpression";
import { isStandaloneBuildConfig } from "../build/types";
import type { EnvironmentContext } from "../types/environmentContext";
import { getBuildInfoVariables } from "./getBuildInfoVariables";
import { getEnvironmentContext } from "./getEnvironmentContext";
import {
  resolveReferences,
  translateLegacyFromComponents,
} from "./resolveReferences";
import { transformJobOnlyVars } from "./transformJobOnlyVars";
import {
  makeSecretEnvVarMapping,
  stringListToSecreteEnvVarList,
  stringifyValues,
} from "./utils/envVars";

export type SecretEnvVar = {
  key: string;
  // hidden env vars are not shown in config-secrets
  hidden?: boolean;
};

const getBasePredefinedVariables = (ctx: EnvironmentContext) => {
  return {
    ENV_SHORT: ctx.env,
    APP_DIR: ctx.envConfigRaw.dir,
    ENV_TYPE: ctx.envType,
    ...(ctx.envType !== "local" ? getBuildInfoVariables(ctx) : {}),
  };
};

type BasePredefinedVariables = ReturnType<typeof getBasePredefinedVariables>;

// we export so that we have later nice autocomplete
export type PredefinedVariables = BasePredefinedVariables & {
  /**
   * undefined in rails, Rails before 6.1 (mis)uses the `HOST` environment variable to specify the IP to bind to
   */
  HOST?: StringOrBashExpression;
  ROOT_URL: StringOrBashExpression;
  HOST_INTERNAL: StringOrBashExpression;
  ROOT_URL_INTERNAL: StringOrBashExpression;
};

export const getEnvironmentVariables = async (
  ctx: CreateComponentContextContext,
  alreadyVisited: Record<string, Record<string, boolean>> = {}, // to prevent endless loop
): Promise<EnvironmentVariables> => {
  const environmentContext = getEnvironmentContext(ctx);

  const { config, env, componentName } = ctx;
  const { envConfigRaw, deployConfigRaw, buildConfigRaw, envType } =
    environmentContext;

  const basePredefinedVariables =
    getBasePredefinedVariables(environmentContext);

  let predefinedVariables: PredefinedVariables & UnspecifiedEnvVars;
  let host: StringOrBashExpression;
  let url: StringOrBashExpression;

  if (envType === "local") {
    const devLocalConfig: DevLocalEnvConfig = envConfigRaw;
    const port = devLocalConfig.port ?? 3000;
    host = "localhost:" + port.toString();
    url = "http://" + host;
    predefinedVariables = {
      ...basePredefinedVariables,
      ENV_SHORT: "local",
      ROOT_URL: url,
      // Rails before 6.1 (mis)uses the `HOST` environment variable to specify the IP to bind to
      ...(isStandaloneBuildConfig(buildConfigRaw) &&
      buildConfigRaw.type === "rails"
        ? {}
        : { HOST: host }),
      HOST_INTERNAL: host,
      ROOT_URL_INTERNAL: "http://" + host,
      PORT: port.toString(),
    };
  } else {
    const additionalEnvVars = deployConfigRaw
      ? DEPLOY_TYPES[deployConfigRaw.type].getAdditionalEnvVars(
          environmentContext as never,
        )
      : {};

    const HOST_INTERNAL =
      additionalEnvVars.HOST_INTERNAL ?? "unknown-host.example.com";

    host = envConfigRaw?.host ?? HOST_INTERNAL;
    url = joinBashExpressions(["https://", host]);

    predefinedVariables = {
      ...basePredefinedVariables,
      // Rails before 6.1 (mis)uses the `HOST` environment variable to specify the IP to bind to
      ...(isStandaloneBuildConfig(buildConfigRaw) &&
      buildConfigRaw.type === "rails"
        ? {}
        : { HOST: host }),
      ROOT_URL: url,
      HOST_INTERNAL,
      /**@deprecated */
      HOST_CANONICAL: HOST_INTERNAL, // legacy alias for HOST_INTERNAL
      ROOT_URL_INTERNAL: joinBashExpressions(["https://", HOST_INTERNAL]),
      ...additionalEnvVars,
    };
  }
  const publicEnvVarsRaw = envConfigRaw.vars?.public ?? {};

  const additionalSecretKeys = deployConfigRaw
    ? DEPLOY_TYPES[deployConfigRaw.type].additionalSecretKeys(
        environmentContext as never,
      )
    : [];

  const secretEnvVarKeys: SecretEnvVar[] = [
    ...stringListToSecreteEnvVarList(envConfigRaw.vars?.secret ?? []),
    ...additionalSecretKeys,
  ];
  const secretEnvVars = makeSecretEnvVarMapping(
    env,
    componentName,
    secretEnvVarKeys,
  );
  // this is deprecated, we now support: $componentname:FOO
  const legacyFromComponents = envConfigRaw.vars?.fromComponents ?? {};
  const publicEnvVarsRawWithLegacyFromComponents = merge(
    {},
    translateLegacyFromComponents(legacyFromComponents),
    publicEnvVarsRaw,
  );

  const publicEnvVarsRawSanitized = stringifyValues(
    publicEnvVarsRawWithLegacyFromComponents,
  );

  const envVarsRaw = addIndexVar({
    ...predefinedVariables,
    ...secretEnvVars,
    ...publicEnvVarsRawSanitized,
  });

  const envVars = (await resolveReferences(
    envVarsRaw,
    async (otherComponentName, alreadyVisited) => {
      const { envVars: otherEnvVars } = await getEnvironmentVariables(
        {
          ...ctx,
          componentName: otherComponentName,
        },
        alreadyVisited,
      );
      return otherEnvVars;
    },
    alreadyVisited,
  )) as typeof envVarsRaw;

  return {
    envVars,
    secretEnvVarKeys,
    jobOnlyVars: {
      build: await transformJobOnlyVars(
        env,
        componentName,
        (buildConfigRaw &&
          isStandaloneBuildConfig(buildConfigRaw) &&
          buildConfigRaw.jobVars) ||
          null,
      ),
      deploy: await transformJobOnlyVars(
        env,
        componentName,
        (deployConfigRaw && deployConfigRaw.jobVars) || null,
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
  key: string,
) => `CL_${sanitizeForEnVar(env)}_${sanitizeForEnVar(componentName)}_${key}`; // remove dash from component name

const addIndexVar = <V extends Record<string, unknown>>(
  vars: V,
): V & { _ALL_ENV_VAR_KEYS: string } => ({
  ...vars,
  _ALL_ENV_VAR_KEYS: JSON.stringify(Object.keys(vars)),
});

export const getSecretVarNameForContext = (
  context: ComponentContext,
  key: string,
) => getSecretVarName(context.env, context.name, key);
