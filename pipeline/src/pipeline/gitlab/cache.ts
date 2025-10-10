import type {
  AgentContext,
  CatladderJobCache,
  Context,
  GitlabJobCache,
} from "../../types";

export const getCacheKeyWithFallbackForMR = (
  baseKey: string,
  context: Context,
) => {
  // if its a branch, create a key with the branch name with fallback to the base key
  if (context.trigger === "mr") {
    return {
      key: baseKey + "-mr$CI_MERGE_REQUEST_IID",
      fallback_keys: [baseKey],
    };
  }

  return {
    key: baseKey,
  };
};

export const addCacheFallback = (
  cache: GitlabJobCache | GitlabJobCache[],
  context: Context | AgentContext,
) => {
  if (context.type !== "agent" && context.trigger === "mr") {
    if (Array.isArray(cache)) {
      return cache.map((c) => addCacheFallbackToSingleCacheForMR(c, context));
    }
    return addCacheFallbackToSingleCacheForMR(cache, context);
  }
  return cache;
};

const addCacheFallbackToSingleCacheForMR = (
  cache: CatladderJobCache,
  context: Context,
) => {
  if (typeof cache.key === "string") {
    return {
      ...cache,
      ...getCacheKeyWithFallbackForMR(cache.key, context),
    };
  }
  return cache; // as is
};
