import { isObject, merge } from "lodash";
import slugify from "slugify";
import {
  DEPLOY_TYPES,
  GCLOUD_RUN_CANONICAL_HOST_SUFFIX,
  getKubernetesNamespace,
} from "../deploy";
import { isOfDeployType } from "../deploy/types";
import type { Config, DevLocalEnvConfig } from "../types/config";
import { isKnowEnvType } from "../types/config";
import type { CommitInfo, Context, Environment } from "../types/context";
import { mergeWithMergingArrays } from "../utils";
import {
  resolveReferences,
  translateLegacyFromComponents,
} from "./resolveReferences";

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
export const getEnvironment = async (
  config: Config,
  componentName: string,
  env: string,
  commitInfo?: CommitInfo,
  alreadyVisited: Record<string, Record<string, boolean>> = {} // to prevent endless loop
): Promise<Environment> => {
  const defaultConfig = config.components[componentName];
  if (!defaultConfig) {
    throw new Error("unknown component " + componentName);
  }

  const envConfig = defaultConfig.env?.[env] ?? {};
  if (envConfig === false) {
    throw new Error("env is disabled: " + env);
  }

  const mergedConfig = mergeWithMergingArrays(defaultConfig, envConfig);

  // env type: if its set manually, use that, otherwise use the known env types

  const envType = envConfig?.type ?? (isKnowEnvType(env) ? env : null);

  if (!envType) {
    throw new Error(
      "Missing type in environment " + env + " in component " + componentName
    );
  }

  const basePredefinedVariables = {
    ENV_SHORT: env,
    APP_DIR: mergedConfig.dir,
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

  if (envType === "local") {
    const devLocalConfig: DevLocalEnvConfig = mergedConfig;
    const port = devLocalConfig.port ?? 3000;
    host = "localhost:" + port;
    url = "http://" + host;
    predefinedVariables = {
      ENV_SHORT: "local",
      ROOT_URL: url,
      PORT: port.toString(),
    };
  } else {
    const componentSlug = slugify(componentName);
    const envInUrl =
      envType === "review" && commitInfo
        ? `${commitInfo.reviewSlug}.${env}`
        : env;

    const domainCanonical =
      (mergedConfig?.deploy &&
        mergedConfig?.deploy.type === "kubernetes" &&
        mergedConfig.deploy.cluster?.domainCanonical) || // for convenience, we allow clusters to define a canonical domain, because a cluster has a fixed ip and you will usually have a domain pointing to that cluster
      config.domainCanonical ||
      "panter.cloud";

    const HOST_CANONICAL = isOfDeployType(mergedConfig.deploy, "kubernetes")
      ? `${componentSlug}.${envInUrl}.${config.appName}.${config.customerName}.${domainCanonical}`
      : isOfDeployType(mergedConfig.deploy, "google-cloudrun")
      ? environmentSlug +
        "-" +
        process.env[
          getSecretVarName(env, componentName, GCLOUD_RUN_CANONICAL_HOST_SUFFIX)
        ]
      : "";
    host = mergedConfig?.host ?? HOST_CANONICAL;
    url = `https://${host}`;

    // FIXME: move to kube specific jobs
    const KUBE_APP_NAME_PREFIX =
      envType === "review" && commitInfo ? `${commitInfo.reviewSlug}-` : "";

    const KUBE_APP_NAME = `${KUBE_APP_NAME_PREFIX}${componentName}`;
    const KUBE_NAMESPACE = getKubernetesNamespace(config, env);

    predefinedVariables = {
      ...basePredefinedVariables,
      HOST_CANONICAL,
      HOST: host,
      ROOT_URL: url,
      KUBE_NAMESPACE,
      KUBE_APP_NAME,
      KUBE_APP_NAME_PREFIX,
    };
  }
  const publicEnvVarsRaw = mergedConfig.vars?.public ?? {};

  const additionalSecretKeys = mergedConfig.deploy
    ? DEPLOY_TYPES[mergedConfig.deploy.type].additionalSecretKeys(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mergedConfig.deploy as any
      )
    : [];

  const secretEnvVarKeys = [
    ...(mergedConfig.vars?.secret ?? []),
    ...additionalSecretKeys,
  ];
  const secretEnvVars = Object.fromEntries(
    secretEnvVarKeys.map((key) => [
      key,
      `$${getSecretVarName(env, componentName, key)}`,
    ])
  );

  // this is deprecated, we now support: $componentname:FOO
  const legacyFromComponents = mergedConfig.vars?.fromComponents ?? {};
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
