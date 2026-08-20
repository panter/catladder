import type { CreateComponentContextContext } from "..";
import type { StringOrBashExpression } from "@catladder/bash";
import { joinBashExpressions } from "@catladder/bash";

import type {
  EnvironmentContext,
  EnvironmentInstance,
} from "../types/environmentContext";
import { getEnvConfig } from "./getEnvConfig";
import { getEnvInstance } from "./getEnvInstance";
import { getEnvType } from "./getEnvType";

const getEnvironmentSlugPrefix = (
  env: string,
  instance: EnvironmentInstance,
): StringOrBashExpression => {
  if (instance.type === "review") {
    return joinBashExpressions([env, instance.reviewSlug], "-");
  }
  return env;
};

export const getEnvironmentContext = ({
  env,
  componentName,
  config,
  pipelineType,
}: CreateComponentContextContext): EnvironmentContext => {
  const envConfigRaw = getEnvConfig(config, componentName, env);
  const envType = getEnvType(env, envConfigRaw, config.environments);
  const instance = getEnvInstance(
    envConfigRaw,
    env,
    pipelineType,
    config.environments,
  );

  // component-level autoStop overrides the project-wide environment
  // config; undefined means the env type's default applies
  const autoStop =
    envConfigRaw.autoStop !== undefined
      ? envConfigRaw.autoStop
      : config.environments?.[env]?.autoStop;

  const environmentSlugPrefix = getEnvironmentSlugPrefix(env, instance);

  const environmentSlug = environmentSlugPrefix.concat(`-${componentName}`);

  const fullName = joinBashExpressions(
    [config.customerName, config.appName, environmentSlug],
    "-",
  );

  return {
    envConfigRaw,
    deployConfigRaw: envConfigRaw.deploy,
    buildConfigRaw: envConfigRaw.build,
    environmentSlugPrefix,
    environmentSlug,
    instance,
    reviewSlug: instance.type === "review" ? instance.reviewSlug : null,
    pipelineType,
    fullName,
    envType,
    autoStop,
    componentName,
    env,
    fullConfig: config,
  };
};
