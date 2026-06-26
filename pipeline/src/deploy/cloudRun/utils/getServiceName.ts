import type { DeployConfigCloudRun } from "../..";
import type { BuildConfig } from "../../../build/types";
import type { ComponentContext } from "../../../types/context";
import type { EnvironmentContext } from "../../../types/environmentContext";
export const getServiceName = (context: ComponentContext) =>
  context.environment.fullName.toLowerCase();

export const getServiceNameForEnvContext = (
  context: EnvironmentContext<BuildConfig, DeployConfigCloudRun>,
) => context.fullName.toLowerCase();
