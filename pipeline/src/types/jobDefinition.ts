import type { CacheConfig } from "../build";
import { CacheConfigAdvanced, CacheConfigSimple } from "../build";
import type { CatladderJob } from "./jobs";

export type JobDefintion = Partial<
  Omit<CatladderJob, "artifacts" | "cache">
> & {
  cache?: CacheConfig[];
};
