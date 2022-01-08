import { merge } from "lodash";
import slugify from "slugify";
import { BUILD_TYPES } from "../build";
import { BuildConfig } from "../build/types";
import { DEPLOY_TYPES } from "../deploy";
import { DeployConfig } from "../deploy/types";
import { Config, isKnowEnvType } from "../types/config";
import { CommitInfo, Context, Environment } from "../types/context";

export const getEnvironment = (
  config: Config,
  componentName: string,
  env: string,
  commitInfo?: CommitInfo
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

  const mergedConfig = merge({}, defaultConfig, envConfig);

  const publicEnvVars = mergedConfig.vars?.public ?? {};
  const secretEnvVarKeys = mergedConfig.vars?.secret ?? [];
  const secretEnvVars = Object.fromEntries(
    secretEnvVarKeys.map((key) => [key, `$CL_${env}_${componentName}_${key}`])
  );
  const referencedRaw = mergedConfig.vars?.fromComponents ?? {};

  const referenced = Object.entries(referencedRaw).reduce(
    (acc, [otherApp, mapping]) => {
      // TODO: prevent infinit looop
      const { envVars } = getEnvironment(config, otherApp, env, commitInfo);

      return {
        ...acc,
        ...Object.fromEntries(
          Object.entries(mapping).map(([ourKey, otherKey]) => [
            ourKey,
            envVars[otherKey],
          ])
        ),
      };
    },
    {}
  );
  // env type: if its set manually, use that, otherwise use the known env types

  const envType = envConfig?.type ?? (isKnowEnvType(env) ? env : null);
  if (!envType) {
    throw new Error(
      "Missing type in environment " + env + " in component " + componentName
    );
  }
  const environmentName =
    envType === "review" && commitInfo
      ? `${env}/${componentName}/${commitInfo.refName}`
      : `${env}/${componentName}`;

  const environmentSlug =
    envType === "review" && commitInfo
      ? `${env}-${componentName}-${commitInfo.refSlug}`
      : `${env}-${componentName}`;
  const KUBE_APP_NAME =
    envType === "review" && commitInfo
      ? `${componentName}-${commitInfo.refSlug}`
      : componentName;

  const KUBE_NAMESPACE = `${config.customerName}-${config.appName}-${env}`;
  const RELEASE_NAME = `${config.customerName}-${config.appName}-${environmentSlug}`;

  const APP_SLUG = slugify(KUBE_APP_NAME);

  const HOST_CANONICAL = `${config.appName}-${APP_SLUG}.${env}.${config.customerName}.panter.cloud`;

  const hostname = mergedConfig?.hostname ?? HOST_CANONICAL;
  const url = `https://${hostname}`;

  const predefinedVariables = {
    HOST_CANONICAL,
    ROOT_URL: url,
    KUBE_NAMESPACE,
    KUBE_APP_NAME,
    RELEASE_NAME,
    ENV_SHORT: env,
    APP_DIR: componentConfig.dir,
  };
  const envVars = {
    ...predefinedVariables,
    ...publicEnvVars,
    ...secretEnvVars,
    ...referenced,
  };

  return {
    envType,
    hostname,
    fullName: environmentName,
    slug: environmentSlug,
    shortName: env,
    url: url,
    envVars,
    secretEnvVarKeys,
  };
};

export const createContext = (
  config: Config,
  componentName: string,
  env: string,
  commitInfo?: CommitInfo
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
  const componentConfigWithoutDefaults = merge({}, rawConfig, envConfig);

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
  const componentConfig = merge({}, defaults, componentConfigWithoutDefaults);

  return {
    fullConfig: config,
    componentConfig,
    componentName,
    environment: getEnvironment(config, componentName, env, commitInfo),
    commitInfo,
  };
};
