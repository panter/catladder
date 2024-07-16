import type { CacheConfigAdvanced } from "..";
import type { CatladderJobCache } from "../../types/jobs";
import { ensureArray } from "../../utils";

export function transformLegacyJobCache(
  jobCache: CatladderJobCache | CatladderJobCache[] | undefined,
): CacheConfigAdvanced[] {
  return ensureArray(jobCache).map((cache) => ({
    pathMode: "absolute",
    ...cache,
    key: cache.key ?? "default",
    paths: cache.paths ?? [],
  }));
}
