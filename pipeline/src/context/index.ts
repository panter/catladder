import { merge } from "lodash";
import slugify from "slugify";
import { BUILD_TYPES } from "../build";
import { BuildConfig } from "../build/types";
import { DEPLOY_TYPES } from "../deploy";
import { DeployConfig } from "../deploy/types";
import { Config, isKnowEnvType } from "../types/config";
import { CommitInfo, Context, Environment } from "../types/context";

const getEnvironment = (
  config: Config,
  componentName: string,
  env: string,
  commitInfo: CommitInfo
): Environment => {
  const componentConfig = config.components[componentName];
  if (!componentConfig) {
    throw new Error("unknown component " + componentName);
  }

  const defaultConfig = componentConfig;
  const envConfig = componentConfig.env?.[env] ?? {};

  const mergedConfig = merge({}, defaultConfig, envConfig);

  const publicEnvVars = mergedConfig.vars?.public ?? {};
  const secretEnvVarsRaw = mergedConfig.vars?.secret ?? {}; // TODO, map to gl secrets?
  const secretEnvVars = {}; // TODO
  const referencedRaw = mergedConfig.vars?.fromComponents ?? {};

  const referenced = Object.entries(referencedRaw).reduce(
    (acc, [otherApp, mapping]) => {
      // TODO: prevent infinit looop
      const { variables } = getEnvironment(config, otherApp, env, commitInfo);

      return Object.fromEntries(
        Object.entries(mapping).map(([ourKey, otherKey]) => [
          ourKey,
          variables[otherKey],
        ])
      );
    },
    {}
  );
  // env type: if its set manually, use that, otherwise use the known env types

  const envType =
    componentConfig.env?.[env]?.type ?? (isKnowEnvType(env) ? env : null);
  if (!envType) {
    throw new Error(
      "Missing type in environment " + env + " in component " + componentName
    );
  }
  const environmentName =
    envType === "review"
      ? `${env}/${componentName}/${commitInfo.refName}`
      : `${env}/${componentName}`;

  const KUBE_APP_NAME =
    envType === "review"
      ? `${componentName}-${commitInfo.refSlug}`
      : componentName;

  const KUBE_NAMESPACE = `${config.customerName}-${config.appName}-${env}`;

  const APP_SLUG = slugify(KUBE_APP_NAME);

  const HOST_CANONICAL = `${config.appName}-${APP_SLUG}.${config.customerName}.panter.cloud`;

  const hostname = mergedConfig.hostname ?? HOST_CANONICAL;
  const url = `https://${hostname}`;

  const predefinedVariables = {
    HOST_CANONICAL,
    ROOT_URL: url,
    KUBE_NAMESPACE,
    KUBE_APP_NAME,
    ENV_SHORT: env,
    APP_DIR: componentConfig.dir,
  };
  const variables = {
    ...predefinedVariables,
    ...publicEnvVars,
    ...secretEnvVars,
    ...referenced,
  };

  return {
    envType,
    hostname,
    fullName: environmentName,
    shortName: env,
    url: url,
    variables,
  };
};

export const createContext = (
  componentName: string,
  config: Config,
  env: string
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
  const commit = {
    refName: process.env.CI_COMMIT_REF_NAME ?? "unknown",
    refSlug: process.env.CI_COMMIT_REF_SLUG ?? "unknown",
  };
  return {
    fullConfig: config,
    componentConfig,
    componentName,
    environment: getEnvironment(config, componentName, env, commit),
    commit: commit,
  };
};
