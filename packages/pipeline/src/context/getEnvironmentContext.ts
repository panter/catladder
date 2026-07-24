import type { CreateComponentContextContext } from "..";
import type { StringOrBashExpression } from "@catladder/bash";
import { joinBashExpressions } from "@catladder/bash";

import type { EnvironmentContext } from "../types/environmentContext";
import { getEnvConfig } from "./getEnvConfig";
import { getEnvType } from "./getEnvType";
import { getReviewSlug } from "./getReviewSlug";

const getEnvironmentSlugPrefix = (
  env: string,
  reviewSlug: StringOrBashExpression | null,
): StringOrBashExpression => {
  if (reviewSlug) {
    return joinBashExpressions([env, reviewSlug], "-");
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
  const envType = getEnvType(env, envConfigRaw);
  const reviewSlug = getReviewSlug(envConfigRaw, env, pipelineType);

  const environmentSlugPrefix = getEnvironmentSlugPrefix(env, reviewSlug);

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
    reviewSlug,
    pipelineType,
    fullName,
    envType,
    componentName,
    env,
    fullConfig: config,
  };
};
