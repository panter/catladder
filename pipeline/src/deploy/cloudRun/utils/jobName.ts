import type { StringOrBashExpression } from "../../../bash/BashExpression";

export const getCloudRunJobName = (
  fullAppName: StringOrBashExpression,
  jobName: string,
): StringOrBashExpression =>
  fullAppName.toLowerCase().concat("-" + jobName.toLowerCase());
