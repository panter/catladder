import type { WithCacheConfig } from "../../build";
import type { GitlabJobImage } from "../../types";
import type { DeployConfigBase } from "./base";

export type DeployConfigCustom = {
  /**
   * custom deploy types allow you to specify custom commands to deploy your app
   */
  type: "custom";
  /**
   * whether the deploy script requires a docker image to be built
   */
  requiresDocker: boolean;
  /**
   * whether your custom script requires the package-manager install
   * (yarn/pnpm, autodetected) to run first
   */
  requiresInstall?: boolean;
  /**
   * @deprecated use {@link requiresInstall} — same behavior (the
   * install always uses the project's detected package manager)
   */
  requiresYarnInstall?: boolean;
  /**
   * your custom script
   */
  script: string[];
  /**
   * script to run to stop the environment
   */
  stopScript?: string[];

  /**
   * image to use
   */
  jobImage?: GitlabJobImage;

  /**
   * job artifact paths the deploy produces (relative to the repo root)
   */
  artifactsPaths?: string[];
} & DeployConfigBase &
  WithCacheConfig;
