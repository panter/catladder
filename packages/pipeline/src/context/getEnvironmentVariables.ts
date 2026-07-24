import { DEPLOY_TYPES } from "../deploy";
import type {
  ComponentContext,
  EnvironmentEnvVarPart as EnvironmentVariables,
} from "../types";
import type { DevLocalEnvConfig } from "../types/config";

import type { CreateComponentContextContext, UnspecifiedEnvVars } from "..";
import type { StringOrBashExpression } from "@catladder/bash";
import { joinBashExpressions } from "@catladder/bash";
import { isStandaloneBuildConfig } from "../build/types";
import type { EnvironmentContext } from "../types/environmentContext";
import { createVariableValueContainingReferencesFromString } from "@catladder/bash";
import { resolveAllReferences } from "@catladder/bash";
import { getBuildInfoVariables } from "./getBuildInfoVariables";
import { getEnvironmentContext } from "./getEnvironmentContext";
import { transformJobOnlyVars } from "./transformJobOnlyVars";
import {
  makeSecretEnvVarMapping,
  normalizeSecretVarsConfig,
  stringifyValues,
} from "./utils/envVars";

export type SecretEnvVar = {
  key: string;
  // hidden env vars are not shown in config-secrets
  hidden?: boolean;
  /**
   * whether the value is sensitive. Both kinds live in the vault and are
   * provided to jobs the same way; platforms that distinguish masked
   * secrets from plain variables (github) treat them differently:
   * "variable" values are unmasked (visible in logs, usable in
   * environment urls) and don't count against secret limits.
   */
  kind?: "secret" | "variable";
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
  HOSTNAME?: StringOrBashExpression;
  ROOT_URL?: StringOrBashExpression;
  HOSTNAME_INTERNAL?: StringOrBashExpression;
  ROOT_URL_INTERNAL?: StringOrBashExpression;
};

export const getEnvironmentVariables = async (
  ctx: CreateComponentContextContext,
  options: { shouldResolveReferences?: boolean } = {},
): Promise<EnvironmentVariables> => {
  const environmentContext = getEnvironmentContext(ctx);

  const { config, env, componentName } = ctx;
  const { envConfigRaw, deployConfigRaw, buildConfigRaw, envType } =
    environmentContext;

  const basePredefinedVariables =
    getBasePredefinedVariables(environmentContext);

  let predefinedVariables: PredefinedVariables & UnspecifiedEnvVars;
  let host: StringOrBashExpression | null;
  let url: StringOrBashExpression | null;

  if (envType === "local") {
    const devLocalConfig: DevLocalEnvConfig = envConfigRaw;
    const port =
      devLocalConfig.port !== false ? (devLocalConfig.port ?? 3000) : null;
    host = port ? "localhost:" + port.toString() : null;
    url = host ? "http://" + host : null;
    predefinedVariables = {
      ...basePredefinedVariables,
      ENV_SHORT: "local",
      ...(url ? { ROOT_URL: url } : {}),
      ...(host ? { HOSTNAME: host } : {}),
      ...(host ? { HOSTNAME_INTERNAL: host } : {}),
      ...(host ? { ROOT_URL_INTERNAL: "http://" + host } : {}),
      ...(port ? { PORT: port.toString() } : {}),
    };
  } else {
    const additionalEnvVars = deployConfigRaw
      ? DEPLOY_TYPES[deployConfigRaw.type].getAdditionalEnvVars(
          environmentContext as never,
        )
      : {};

    const HOSTNAME_INTERNAL =
      additionalEnvVars.HOSTNAME_INTERNAL ?? "unknown-host.example.com";

    host = envConfigRaw?.host ?? HOSTNAME_INTERNAL;
    url = joinBashExpressions(["https://", host]);

    predefinedVariables = {
      ...basePredefinedVariables,
      HOSTNAME: host,
      ROOT_URL: url,
      HOSTNAME_INTERNAL,
      ROOT_URL_INTERNAL: joinBashExpressions(["https://", HOSTNAME_INTERNAL]),
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
    ...normalizeSecretVarsConfig(envConfigRaw.vars?.secret),
    ...additionalSecretKeys,
  ];
  const secretEnvVars = makeSecretEnvVarMapping(
    env,
    componentName,
    secretEnvVarKeys,
  );

  const publicEnvVarsRawSanitized = stringifyValues(publicEnvVarsRaw);

  const publicEnvVarsUnresolved = Object.fromEntries(
    Object.entries(publicEnvVarsRawSanitized).map(([key, value]) => [
      key,
      createVariableValueContainingReferencesFromString(value, {
        componentName: ctx.componentName,
      }),
    ]),
  );

  const publicEnvVars =
    (options.shouldResolveReferences ?? true)
      ? await resolveAllReferences(
          publicEnvVarsUnresolved,
          async (otherComponentName) => {
            const { envVars: otherEnvVars } = await getEnvironmentVariables(
              {
                ...ctx,
                componentName: otherComponentName,
              },
              {
                shouldResolveReferences: false, // we already do this here with replaceAllReferences recursivly until re replaced all
              },
            );
            return otherEnvVars;
          },
        )
      : publicEnvVarsUnresolved;

  const envVars = addIndexVar({
    ...predefinedVariables,
    ...secretEnvVars,
    ...publicEnvVars,
  });

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
