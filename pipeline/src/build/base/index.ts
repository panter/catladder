import { sbomDeactivated } from "../../deploy/sbom";
import type { WorkspaceContext } from "../../types/context";
import {
  componentContextHasWorkspaceBuild,
  componentContextIsStandaloneBuild,
  type ComponentContext,
} from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import type { DockerBuildJobDefinition } from "../docker";
import { createDockerBuildJobBase, requiresDockerBuild } from "../docker";
import { createSbomBuildJob } from "../sbom";
import { APP_BUILD_JOB_NAME } from "./constants";
import type { AppBuildJobDefinition } from "./createAppBuildJob";
import { createAppBuildJob } from "./createAppBuildJob";

export const createComponentBuildJobs = (
  context: ComponentContext,
  definitions: {
    appBuild?: AppBuildJobDefinition;
    dockerBuild: DockerBuildJobDefinition;
  },
): CatladderJob[] => {
  return [
    ...(definitions.appBuild && componentContextIsStandaloneBuild(context)
      ? [createAppBuildJob(context, definitions.appBuild)]
      : []),
    ...(requiresDockerBuild(context)
      ? [
          createDockerBuildJobBase(context, {
            ...definitions.dockerBuild,
            needs: [
              ...(definitions.dockerBuild.needs ?? []),
              ...(definitions.appBuild &&
              componentContextIsStandaloneBuild(context)
                ? [APP_BUILD_JOB_NAME]
                : componentContextHasWorkspaceBuild(context)
                  ? [
                      {
                        job: APP_BUILD_JOB_NAME,
                        artifacts: true,
                        workspaceName: context.build.workspaceName,
                      },
                    ]
                  : []),
            ],
          }),
        ]
      : []),
    ...(sbomDeactivated(context) ? [] : [createSbomBuildJob(context)]),
  ];
};

export const createWorkspaceBuildJobs = (
  context: WorkspaceContext,
  definitions: {
    appBuild?: AppBuildJobDefinition;
  },
): CatladderJob[] => {
  return definitions.appBuild
    ? [createAppBuildJob(context, definitions.appBuild)]
    : [];
};
