import { getRunnerImage } from "../../runner";
import type {
  BuildContextStandalone,
  WorkspaceContext,
} from "../../types/context";
import {
  componentContextIsStandaloneBuild,
  type ComponentContext,
} from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray } from "../../utils";
import { createComponentBuildJobs, createWorkspaceBuildJobs } from "../base";
import type { AppBuildJobDefinition } from "../base/createAppBuildJob";
import type { DockerBuildJobDefinition } from "../docker";
import { getDockerBuildScriptWithBuiltInDockerFile } from "../docker";
import type { BuildConfigDocker } from "../types";
import { isOfBuildType } from "../types";
import { getNextCache, getNodeCache, getYarnCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import { getDockerAppCopyAndBuildScript, getYarnInstall } from "./yarn";

export const createNodeBuildJobs = (
  context: ComponentContext | WorkspaceContext,
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

  if (!isOfBuildType(buildConfig, "node", "node-static", "storybook")) {
    throw new Error("deploy config is not node, node-static or storybook");
  }

  if (buildConfig.buildCommand === null) return undefined;

  const defaultImage = getRunnerImage("jobs-default");
  const yarnInstall = getYarnInstall(context);

  return {
    image: buildConfig.jobImage ?? defaultImage,
    runnerVariables: NODE_RUNNER_BUILD_VARIABLES,
    cache: [
      ...(ensureArray(buildConfig.jobCache) ?? []),
      ...getNodeCache(context),
      ...getNextCache(context),
    ],
    script: [...yarnInstall, ...(ensureArray(buildConfig.buildCommand) ?? [])],
    jobTags: buildConfig.jobTags,
  };
};

export const createNodeDockerJobDefinition = (
  context: ComponentContext,
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
