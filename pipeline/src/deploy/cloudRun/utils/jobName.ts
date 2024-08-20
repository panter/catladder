import type { StringOrBashExpression } from "../../../bash/BashExpression";
import type { ComponentContext } from "../../../types";

export const getCloudRunJobName = (
  fullAppName: StringOrBashExpression,
  jobName: StringOrBashExpression,
): StringOrBashExpression =>
  fullAppName.toLowerCase().concat("-" + jobName.toLowerCase());

export const getFullJobName = (
  context: ComponentContext,
  name: StringOrBashExpression,
) => getCloudRunJobName(context.environment.fullName, name);

export const getCloudRunSchedulerName = (
  fullAppName: StringOrBashExpression,
  schedulerName: string,
): StringOrBashExpression =>
  fullAppName.toLowerCase().concat("-" + schedulerName.toLowerCase());

export const getFullSchedulerName = (context: ComponentContext, name: string) =>
  getCloudRunSchedulerName(context.environment.fullName, name);
