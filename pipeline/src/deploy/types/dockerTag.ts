import type { DeployConfigBase } from "./base";

export type DeployConfigDockerTag = {
  /**
   * adds a custom tag on the repo to deploy it.
   *
   * only used in veloplus atm, generally not recommended to use
   * because run-time environment variables have to be coordinated
   * manually with the platform running the container.
   */
  type: "dockerTag";

  tag: string;
} & DeployConfigBase;
