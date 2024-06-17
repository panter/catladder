import { sbomDeactivated } from "../../deploy/sbom";
import type { ComponentContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import type { DockerBuildJobDefinition } from "../docker";
import { createDockerBuildJobBase, requiresDockerBuild } from "../docker";
import { createSbomBuildJob } from "../sbom";
import { APP_BUILD_JOB_NAME } from "./constants";
import type { AppBuildJobDefinition } from "./createAppBuildJob";
import { createAppBuildJob } from "./createAppBuildJob";

export const createBuildJobs = (
  context: ComponentContext,
  definitions: {
    appBuild?: AppBuildJobDefinition;
    dockerBuild: DockerBuildJobDefinition;
  },
): CatladderJob[] => {
  return [
    ...(definitions.appBuild
      ? [createAppBuildJob(context, definitions.appBuild)]
      : []),
    ...(requiresDockerBuild(context)
      ? [
          createDockerBuildJobBase(context, {
            ...definitions.dockerBuild,
            needs: [
              ...(definitions.dockerBuild.needs ?? []),
              ...(definitions.appBuild ? [APP_BUILD_JOB_NAME] : []),
            ],
          }),
        ]
      : []),
    ...(sbomDeactivated(context) ? [] : [createSbomBuildJob(context)]),
  ];
};
