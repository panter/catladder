import type { CacheConfig } from "../build";
import type { CatladderJobSpec } from "./jobs";

// new intermediate types. Currently not widely used, but we will built a bit  more abstraction on top of this

export type AppBuildJobDefinition = Partial<
  Omit<CatladderJobSpec, "artifacts" | "cache">
> & {
  cache?: CacheConfig[];
};

export type DockerBuildJobDefinition = AppBuildJobDefinition; // currently the same

export type DeployJobDefinition = Pick<
  CatladderJobSpec,
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
  CatladderJobSpec,
  "script" | "variables" | "image" | "runnerVariables"
>;

export type RollbackJobDefinition = Pick<
  CatladderJobSpec,
  "script" | "variables" | "runnerVariables" | "image"
>;
