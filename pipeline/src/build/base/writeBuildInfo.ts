import type { ComponentContext } from "../../types";

export const writeBuildInfo = (context: ComponentContext) => {
  return [
    `echo '{"id":"${context.environment.envVars.BUILD_INFO_BUILD_ID}","time":"${context.environment.envVars.BUILD_INFO_BUILD_TIME}"}' > ${context.componentConfig.dir}/__build_info.json`,
  ];
};
