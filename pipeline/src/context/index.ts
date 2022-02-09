import { merge, mergeWith } from "lodash";
import slugify from "slugify";
import { BUILD_TYPES } from "../build";
import { BuildConfig } from "../build/types";
import { DEPLOY_TYPES, getKubernetesNamespace } from "../deploy";
import { DeployConfig } from "../deploy/types";
import { Config, isKnowEnvType, DevLocalEnvConfig } from "../types/config";
import { CommitInfo, Context, Environment, YarnInfo } from "../types/context";
import { mergeWithMergingArrays } from "../utils";

const sanitizeForEnVar = (s: string) => s.replace(/-/g, "_");
export const getSecretVarName = (
  env: string,
  componentName: string,
  key: string
) => `CL_${sanitizeForEnVar(env)}_${sanitizeForEnVar(componentName)}_${key}`; // remove dash from component name

export const getSecretVarNameForContext = (context: Context, key: string) =>
  getSecretVarName(context.environment.shortName, context.componentName, key);
export const getEnvironment = (
  config: Config,
  componentName: string,
  env: string,
  commitInfo?: CommitInfo,
  skipReferences = false // to prevent infinit loop
): Environment => {
  const componentConfig = config.components[componentName];
  if (!componentConfig) {
    throw new Error("unknown component " + componentName);
  }

  const defaultConfig = componentConfig;

  const envConfig = componentConfig.env?.[env] ?? {};
  if (envConfig === false) {
    throw new Error("env is disabled: " + env);
  }

  const mergedConfig = mergeWithMergingArrays(defaultConfig, envConfig);

  // env type: if its set manually, use that, otherwise use the known env types

  const basePredefinedVariables = {
    ENV_SHORT: env,
    APP_DIR: componentConfig.dir,
  };
  const envType = envConfig?.type ?? (isKnowEnvType(env) ? env : null);
  if (!envType) {
    throw new Error(
      "Missing type in environment " + env + " in component " + componentName
    );
  }
  const environmentName =
    envType === "review" && commitInfo
      ? `${env}/${commitInfo.refName}/${componentName}`
      : `${env}/${componentName}`;

  const environmentSlug =
    envType === "review" && commitInfo
      ? `${env}-${commitInfo.refSlug}-${componentName}`
      : `${env}-${componentName}`;

  let predefinedVariables: Record<string, string>;
  let host: string;
  let url: string;
  if (envType === "local") {
    const devLocalConfig: DevLocalEnvConfig = mergedConfig;
    const port = devLocalConfig.port ?? 3000;
    host = "localhost:" + port;
    url = "http://" + host;
    predefinedVariables = {
      ROOT_URL: url,
      PORT: port.toString(),
    };
  } else {
    const RELEASE_NAME = `${config.customerName}-${config.appName}-${environmentSlug}`;

    const componentSlug = slugify(componentName);
    const envInUrl =
      envType === "review" && commitInfo ? `${commitInfo.refSlug}.${env}` : env;

    const domainCanonical =
      (mergedConfig?.deploy && mergedConfig.deploy.cluster?.domainCanonical) || // for convenience, we allow clusters to define a canonical domain, because a cluster has a fixed ip and you will usually have a domain pointing to that cluster
      config.domainCanonical ||
      "panter.cloud";

    const HOST_CANONICAL = `${componentSlug}.${envInUrl}.${config.appName}.${config.customerName}.${domainCanonical}`;
    host = mergedConfig?.host ?? HOST_CANONICAL;
    const url = `https://${host}`;

    // FIXME: move to kube specific jobs
    const KUBE_APP_NAME =
      envType === "review" && commitInfo
        ? `${commitInfo.refSlug}-${componentName}`
        : componentName;
    const KUBE_NAMESPACE = getKubernetesNamespace(config, env);

    predefinedVariables = {
      ...basePredefinedVariables,
      HOST_CANONICAL,
      ROOT_URL: url,
      KUBE_NAMESPACE,
      KUBE_APP_NAME,
      RELEASE_NAME,
    };
  }
  const publicEnvVars = mergedConfig.vars?.public ?? {};
  const secretEnvVarKeys = mergedConfig.vars?.secret ?? [];
  const secretEnvVars = Object.fromEntries(
    secretEnvVarKeys.map((key) => [
      key,
      `$${getSecretVarName(env, componentName, key)}`,
    ])
  );
  const referencedRaw = mergedConfig.vars?.fromComponents ?? {};

  const referenced = skipReferences
    ? {}
    : Object.entries(referencedRaw).reduce((acc, [otherApp, mapping]) => {
        const { envVars } = getEnvironment(
          config,
          otherApp,
          env,
          commitInfo,
          true // prevent infinit loop
        );

        return {
          ...acc,
          ...Object.fromEntries(
            Object.entries(mapping).map(([ourKey, otherKey]) => [
              ourKey,
              envVars[otherKey],
            ])
          ),
        };
      }, {});

  const envVars = {
    ...predefinedVariables,
    ...secretEnvVars,
    ...referenced,
    ...publicEnvVars,
  };

  return {
    envType,
    host,
    fullName: environmentName,
    slug: environmentSlug,
    shortName: env,
    url: predefinedVariables.ROOT_URL,
    envVars,
    secretEnvVarKeys,
  };
};

export const createContext = (
  config: Config,
  componentName: string,
  env: string,
  commitInfo?: CommitInfo,
  yarnInfo?: YarnInfo
): Context => {
  if (!/^[a-z0-9-]+$/.test(componentName)) {
    throw new Error(
      "componentName may only contain lower case letters, numbers and -"
    );
  }
  const rawConfig = config.components[componentName];
  if (!rawConfig) {
    throw new Error("unknown component " + componentName);
  }
  // envs can override the config
  const envConfig = rawConfig.env?.[env] ?? {};
  const componentConfigWithoutDefaults = mergeWithMergingArrays(
    rawConfig,
    envConfig
  );

  // fill in defaults of build and deploy
  const defaults: {
    build: Partial<BuildConfig>;
    deploy: Partial<DeployConfig>;
  } = componentConfigWithoutDefaults.deploy
    ? {
        build:
          BUILD_TYPES[componentConfigWithoutDefaults.build.type].defaults(),
        deploy:
          DEPLOY_TYPES[componentConfigWithoutDefaults.deploy.type].defaults(),
      }
    : {
        build: {},
        deploy: {},
      };
  const componentConfig = mergeWithMergingArrays(
    defaults,
    componentConfigWithoutDefaults
  );

  return {
    fullConfig: config,
    componentConfig,
    componentName,
    environment: getEnvironment(config, componentName, env, commitInfo),
    commitInfo,
    yarnInfo,
  };
};
