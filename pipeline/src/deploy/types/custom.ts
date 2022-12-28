import type { CatladderJob } from "../../types/jobs";
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
   * whether your custom script requires yarn install
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
  jobImage?: string;

  /**
   * customize cache for the job
   */
  jobCache?: CatladderJob["cache"];
} & DeployConfigBase;
