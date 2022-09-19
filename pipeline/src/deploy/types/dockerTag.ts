import type { DeployConfigBase } from "./base";

export type DeployConfigDockerTag = {
  /**
   * adds a custom tag on the repo to deploy it.
   *
   * only used in veloplus atm, generally not recommended to use
   */
  type: "dockerTag";

  tag: string;
} & DeployConfigBase;
