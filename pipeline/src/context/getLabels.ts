import slugify from "slugify";
import type { ComponentContext } from "../types";

const sanitize = (value?: string) => {
  if (!value) return value;
  //"The value can only contain lowercase letters, numeric characters, underscores and dashes. The value can be at most 63 characters long. International characters are allowed."
  // slugify should do the job
  return slugify(value).toLowerCase();
};
export const getLabels = (context: ComponentContext) => {
  const labels = {
    "customer-name": sanitize(context.fullConfig.customerName),
    "component-name": sanitize(context.name),
    "app-name": sanitize(context.fullConfig.appName),
    "env-type": sanitize(context.environment.envType),
    "env-name": sanitize(context.env),
    "build-type": sanitize(context.build.buildType),
    ...(context.fullConfig.meta?.labels ?? {}),
  };
  return labels;
};
