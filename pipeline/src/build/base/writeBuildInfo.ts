import type { Context } from "../../types";

export const writeBuildInfo = (context: Context) => {
  return [
    `echo '{"id":"${context.commitInfo?.buildId}","time":"${context.commitInfo?.buildTime}"}' > ${context.componentConfig.dir}/__build_info.json`,
  ];
};
