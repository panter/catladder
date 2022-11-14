import type { Config, EnvConfigWithComponent } from "../types/config";

import type { CommitInfo } from "../types/context";
import type { EnvironmentContext } from "../types/environmentContext";
import { getEnvConfig } from "./getEnvConfig";
import { getEnvType } from "./getEnvType";

const getEnvironmentSlug = (
  envConfig: EnvConfigWithComponent,
  env: string,
  componentName: string,
  commitInfo?: CommitInfo
) => {
  const envType = getEnvType(env, envConfig);

  return envType === "review" && commitInfo
    ? `${env}-${commitInfo.reviewSlug}-${componentName}`
    : `${env}-${componentName}`;
};

export const getEnvironmentContext = (
  config: Config,
  env: string,
  componentName: string,
  commitInfo?: CommitInfo
): EnvironmentContext<any, any> => {
  const envConfigRaw = getEnvConfig(config, componentName, env);
  const envType = getEnvType(env, envConfigRaw);

  const environmentSlug = getEnvironmentSlug(
    envConfigRaw,
    env,
    componentName,
    commitInfo
  );

  const gitlabEnvironmentName =
    envType === "review" && commitInfo
      ? `${env}/${commitInfo.refName}/${componentName}`
      : `${env}/${componentName}`;

  const fullName = `${config.customerName}-${config.appName}-${environmentSlug}`;

  return {
    envConfigRaw,
    deployConfigRaw: envConfigRaw.deploy,
    buildConfigRaw: envConfigRaw.build,
    environmentSlug,
    gitlabEnvironmentName,
    fullName,
    envType,
    commitInfo,
    componentName,
    env,
    fullConfig: config,
  };
};
