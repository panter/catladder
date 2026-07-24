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

export const createNodeBuildJobs = async (
  context: ComponentContextWithBuild | WorkspaceContext,
): Promise<CatladderJob[]> => {
  if (context.type === "workspace") {
    return createWorkspaceBuildJobs(context, {
      appBuild: await createNodeBuildJobDefinition(context),
    });
  }
  return createComponentBuildJobs(context, {
    appBuild: componentContextIsStandaloneBuild(context)
      ? await createNodeBuildJobDefinition(context)
      : undefined,

    dockerBuild: await createNodeDockerJobDefinition(context),
  });
};

export const createNodeBuildJobDefinition = async (
  context: ComponentContext<BuildContextStandalone> | WorkspaceContext,
): Promise<AppBuildJobDefinition | undefined> => {
  const buildConfig = context.build.config;

  const [yarnInstall, nodeCache] = await Promise.all([
    getYarnInstall(context),
    getNodeCache(context),
  ]);
  return createBuildJobDefinition(context, buildConfig, {
    prescript: yarnInstall,
    cache: nodeCache,
  });
};

type NewType = ComponentContextWithBuild;

export const createNodeDockerJobDefinition = async (
  context: NewType,
): Promise<DockerBuildJobDefinition> => {
  // get the default docker built-in type based on the build type
  const dockerDefaultBuiltIn: BuildConfigDocker["type"] =
    context.build.buildType === "node-static" ||
    context.build.buildType === "storybook"
      ? "nginx"
      : "node";

  const [yarnCache, dockerAppCopyAndBuildScript, packageManagerInfo] =
    await Promise.all([
      getYarnCache(context, "pull"),
      getDockerAppCopyAndBuildScript(context),
      context.packageManagerInfo,
    ]);

  return {
    script: getDockerBuildScriptWithBuiltInDockerFile(
      context,
      dockerDefaultBuiltIn,
    ),
    cache: [...yarnCache],
    variables: {
      // only required for non static
      DOCKER_COPY_AND_INSTALL_APP: dockerAppCopyAndBuildScript,
      DOCKER_COPY_WORKSPACE_FILES: packageManagerInfo?.pathsToCopyInDocker
        .map((dir) => `COPY --chown=node:node ${dir} /app/${dir}`)
        ?.join("\n"),
    },
  };
};
