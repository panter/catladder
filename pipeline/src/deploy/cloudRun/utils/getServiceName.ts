import type { ComponentContext } from "../../../types/context";
export const getServiceName = (context: ComponentContext) =>
  context.environment.fullName.toLowerCase();
