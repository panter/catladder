import type {
  BuildContextStandalone,
  ComponentContextWithBuild,
  WorkspaceContext,
} from "../../types/context";
import {
  componentContextIsStandaloneBuild,
  type ComponentContext,
} from "../../types/context";
import type {
  AppBuildJobDefinition,
  DockerBuildJobDefinition,
} from "../../types/jobDefinition";
import type { CatladderJob } from "../../types/jobs";
import { createComponentBuildJobs, createWorkspaceBuildJobs } from "../base";
import { createBuildJobDefinition } from "../base/createBuildJobDefinition";
import { getDockerBuildScriptWithBuiltInDockerFile } from "../docker";
import type { BuildConfigDocker } from "../types";
import { getNodeCache, getYarnCache } from "./cache";
import { getDockerAppCopyAndBuildScript, getYarnInstall } from "./yarn";

export const createNodeBuildJobs = (
  context: ComponentContextWithBuild | WorkspaceContext,
): CatladderJob[] => {
  if (context.type === "workspace") {
    return createWorkspaceBuildJobs(context, {
      appBuild: createNodeBuildJobDefinition(context),
    });
  }
  return createComponentBuildJobs(context, {
    appBuild: componentContextIsStandaloneBuild(context)
      ? createNodeBuildJobDefinition(context)
      : undefined,

    dockerBuild: createNodeDockerJobDefinition(context),
  });
};

export const createNodeBuildJobDefinition = (
  context: ComponentContext<BuildContextStandalone> | WorkspaceContext,
): AppBuildJobDefinition | undefined => {
  const buildConfig = context.build.config;

  const yarnInstall = getYarnInstall(context);
  return createBuildJobDefinition(context, buildConfig, {
    prescript: yarnInstall,
    cache: getNodeCache(context),
  });
};

type NewType = ComponentContextWithBuild;

export const createNodeDockerJobDefinition = (
  context: NewType,
): DockerBuildJobDefinition => {
  // get the default docker built-in type based on the build type
  const dockerDefaultBuiltIn: BuildConfigDocker["type"] =
    context.build.buildType === "node-static" ||
    context.build.buildType === "storybook"
      ? "nginx"
      : "node";

  return {
    script: getDockerBuildScriptWithBuiltInDockerFile(
      context,
      dockerDefaultBuiltIn,
    ),
    cache: [...getYarnCache(context, "pull")],
    variables: {
      // only required for non static
      DOCKER_COPY_AND_INSTALL_APP: getDockerAppCopyAndBuildScript(context),
      DOCKER_COPY_WORKSPACE_FILES:
        context.packageManagerInfo?.pathsToCopyInDocker
          .map((dir) => `COPY --chown=node:node ${dir} /app/${dir}`)
          ?.join("\n"),
    },
  };
};
