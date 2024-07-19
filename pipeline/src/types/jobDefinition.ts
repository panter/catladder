import type { CacheConfig } from "../build";
import type { CatladderJob } from "./jobs";

// new intermediate types. Currently not widely used, but we will built a bit  more abstraction on top of this

export type AppBuildJobDefinition = Partial<
  Omit<CatladderJob, "artifacts" | "cache">
> & {
  cache?: CacheConfig[];
};

export type DockerBuildJobDefinition = AppBuildJobDefinition; // currently the same

export type DeployJobDefinition = Pick<
  CatladderJob,
  | "script"
  | "variables"
  | "image"
  | "artifacts"
  | "services"
  | "runnerVariables"
> & {
  cache?: CacheConfig[];
};

export type StopJobDefinition = Pick<
  CatladderJob,
  "script" | "variables" | "image" | "runnerVariables"
>;

export type RollbackJobDefinition = Pick<
  CatladderJob,
  "script" | "variables" | "runnerVariables" | "image"
>;
