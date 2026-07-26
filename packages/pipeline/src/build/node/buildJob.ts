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

  // the pnpm store (pulled via the cache above) is copied into the
  // image so the prod install works offline — like the yarn zip cache,
  // which travels inside the copied `.yarn` config folder
  const copyPnpmStore =
    packageManagerInfo.type === "pnpm" &&
    packageManagerInfo.componentIsInWorkspace;

  // pnpm copies every workspace manifest into the image — as individual
  // COPY instructions that many layers exceed docker's depth limit, so
  // the job tars them up and a single ADD extracts them
  const isPnpm = packageManagerInfo.type === "pnpm";
  const WORKSPACE_FILES_TAR = ".catladder-workspace-files.tar";

  return {
    script: [
      // the COPY source must exist even when the cache was cold
      ...(copyPnpmStore ? ["mkdir -p .pnpm-store"] : []),
      ...(isPnpm
        ? [
            `tar -cf ${WORKSPACE_FILES_TAR} ${packageManagerInfo.pathsToCopyInDocker.join(" ")}`,
          ]
        : []),
      ...getDockerBuildScriptWithBuiltInDockerFile(
        context,
        dockerDefaultBuiltIn,
      ),
    ],
    cache: [...yarnCache],
    variables: {
      // only required for non static
      DOCKER_COPY_AND_INSTALL_APP: dockerAppCopyAndBuildScript,
      DOCKER_COPY_WORKSPACE_FILES: isPnpm
        ? [
            `ADD --chown=node:node ${WORKSPACE_FILES_TAR} /app/`,
            ...(copyPnpmStore
              ? [`COPY --chown=node:node .pnpm-store /app/.pnpm-store`]
              : []),
          ].join("\n")
        : packageManagerInfo.pathsToCopyInDocker
            .map((dir) => `COPY --chown=node:node ${dir} /app/${dir}`)
            .join("\n"),
      // pnpm is not preinstalled in the node base images; installed as
      // root before the image switches to the node user
      ...(isPnpm
        ? {
            DOCKER_SETUP_PACKAGE_MANAGER: `RUN npm install -g pnpm@${packageManagerInfo.version}`,
          }
        : {}),
    },
  };
};
