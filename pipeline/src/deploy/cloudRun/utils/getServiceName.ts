import type { Context } from "../../../types/context";
export const getServiceName = (context: Context) =>
  context.environment.fullName.toLowerCase();
