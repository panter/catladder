import { isOfDeployType } from "../deploy";
import type { Config } from "../types/config";

import type { CommitInfo, Environment } from "../types/context";
import { getEnvironmentContext } from "./getEnvironmentContext";
import { getEnvironmentVariables } from "./getEnvironmentVariables";

export const getEnvironment = async (
  config: Config,
  componentName: string,
  env: string,
  commitInfo?: CommitInfo
): Promise<Environment> => {
  const variables = await getEnvironmentVariables(
    config,
    componentName,
    env,
    commitInfo
  );

  const envContext = getEnvironmentContext(
    config,
    env,
    componentName,
    commitInfo
  );

  const envType = envContext.envType;
  const deployConfig = config.components[componentName].deploy;

  const gitlabEnvironment = {
    name: envContext.gitlabEnvironmentName,
    ...(!isOfDeployType(deployConfig, "google-cloudrun") ||
    deployConfig.service !== false
      ? { url: variables.url }
      : {}),
  };

  return {
    envType,

    gitlabEnvironment,
    fullName: envContext.fullName,
    slugPrefix: envContext.environmentSlugPrefix,
    slug: envContext.environmentSlug,
    shortName: env,
    ...variables,
  };
};
