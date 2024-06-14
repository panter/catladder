import type { CreateContextContext } from "..";

import type { Environment } from "../types/context";
import { getEnvironmentContext } from "./getEnvironmentContext";
import { getEnvironmentVariables } from "./getEnvironmentVariables";

export const getEnvironment = async (
  ctx: CreateContextContext,
): Promise<Environment> => {
  const { env } = ctx;
  const variables = await getEnvironmentVariables(ctx);

  const envContext = getEnvironmentContext(ctx);

  const envType = envContext.envType;

  return {
    envType,
    fullName: envContext.fullName,
    slugPrefix: envContext.environmentSlugPrefix,
    reviewSlug: envContext.reviewSlug,
    slug: envContext.environmentSlug,
    shortName: env,
    ...variables,
  };
};
