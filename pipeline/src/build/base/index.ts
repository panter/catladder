import type {
  ComponentContextWithBuild,
  WorkspaceContext,
} from "../../types/context";
import {
  componentContextHasWorkspaceBuild,
  componentContextIsStandaloneBuild,
} from "../../types/context";
import type {
  AppBuildJobDefinition,
  DockerBuildJobDefinition,
} from "../../types/jobDefinition";
import type { CatladderJob } from "../../types/jobs";
import { createDockerBuildJobBase, requiresDockerBuild } from "../docker";
import { APP_BUILD_JOB_NAME } from "./constants";
import { createAppBuildJob } from "./createAppBuildJob";

export const createComponentBuildJobs = async (
  context: ComponentContextWithBuild,
  definitions: {
    appBuild?: AppBuildJobDefinition;
    dockerBuild: DockerBuildJobDefinition;
  },
): Promise<CatladderJob[]> => {
  return [
    ...(definitions.appBuild && componentContextIsStandaloneBuild(context)
      ? [await createAppBuildJob(context, definitions.appBuild)]
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
  ];
};

export const createWorkspaceBuildJobs = async (
  context: WorkspaceContext,
  definitions: {
    appBuild?: AppBuildJobDefinition;
  },
): Promise<CatladderJob[]> => {
  return definitions.appBuild
    ? [await createAppBuildJob(context, definitions.appBuild)]
    : [];
};
