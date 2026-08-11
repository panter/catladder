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
import {
  getDockerAppCopyAndBuildScript,
  getPackageManagerInstall,
} from "./packageManagerInstall";

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

  const [packageManagerInstall, nodeCache] = await Promise.all([
    getPackageManagerInstall(context),
    getNodeCache(context),
  ]);
  return createBuildJobDefinition(context, buildConfig, {
    prescript: packageManagerInstall,
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

  // The pnpm store is deliberately NOT copied into the image. It used
  // to be, so the prod install could link instead of hitting the
  // registry — but the store lands in an earlier layer than
  // node_modules, so pnpm cannot hardlink across the overlay boundary
  // and copies every package instead. Measured on one component: the
  // in-image install was *slower* that way (28s vs 10s from the
  // registry), the store added 3GB to the build context and the final
  // image, and the build took 339s instead of 27s.

  // pnpm copies every workspace manifest into the image — as individual
  // COPY instructions that many layers exceed docker's depth limit, so
  // the job tars them up and a single ADD extracts them
  const isPnpm = packageManagerInfo.type === "pnpm";
  const WORKSPACE_FILES_TAR = ".catladder-workspace-files.tar";

  return {
    script: [
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
            `ADD ${WORKSPACE_FILES_TAR} /app/`,
            // ADD does not apply --chown to extracted tars, and parent
            // dirs of the entries come out root-owned — fix ownership
            // while the stage still runs as root (this only touches the
            // small manifest tree). Custom base images without a node
            // user run as root and don't need it, hence the fallback
            `RUN chown -R node:node /app || true`,
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
