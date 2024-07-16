import type { Context } from "../../types";
import { ensureArray } from "../../utils/index";
import type {
  BuildConfigStandalone,
  CacheConfig,
  WorkspaceBuildConfig,
} from "../types";
import { transformLegacyJobCache } from "./transformLegacyJobCache";

export const getAllCacheConfigsFromConfig = (
  context: Context,
  buildConfig: BuildConfigStandalone | WorkspaceBuildConfig,
): CacheConfig[] => {
  return [
    ...("jobCache" in buildConfig
      ? transformLegacyJobCache(buildConfig.jobCache)
      : []),
    ...ensureArray(buildConfig.cache).map((c) => ({
      ...c,
      context,
    })),
    ...(context.type === "workspace"
      ? // also add cache configs of the components of that workspace
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
