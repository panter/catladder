import type { RunnerImageName } from "../../runner";
import type { DeployConfigBase } from "./base";

export type DeployConfigCustom = {
  type: "custom";
  requiresDocker: boolean;
  requiresYarnInstall?: boolean;
  script: string[];
  stopScript?: string[];
  image?: RunnerImageName;
} & DeployConfigBase;
