import type { Context } from "../../types";
import { ensureArray } from "../../utils/index";
import type { CacheConfig, WithCacheConfig } from "../types";
import { transformLegacyJobCache } from "./transformLegacyJobCache";

export const getAllCacheConfigsFromConfig = (
  context: Context,
  configWithCache: WithCacheConfig,
): CacheConfig[] => {
  return [
    ...("jobCache" in configWithCache
      ? transformLegacyJobCache(configWithCache.jobCache)
      : []),
    ...ensureArray(configWithCache.cache),
    ...(context.type === "workspace"
      ? // also add cache configs of the components of that workspace
        // FIXNME: this only works currently for the build config
        // we would probably need to introduce a path to the right config property (build-->test or so)
        context.components.flatMap<CacheConfig>(
          (componentContext) =>
            ensureArray(componentContext.build.config.cache).map((c) => ({
              ...c,
              baseDir: componentContext.build.dir,
            })) ?? [],
        )
      : []),
  ];
};
