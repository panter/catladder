import { join } from "path";
import { getRunnerImage } from "../../runner";
import type { ComponentContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray } from "../../utils";
import { createBuildJobs } from "../base";
import { getDockerBuildScriptWithBuiltInDockerFile } from "../docker";
import { isOfBuildType } from "../types";
import { getNextCache, getNodeCache, getYarnCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import { getDockerAppCopyAndBuildScript, getYarnInstall } from "./yarn";

export const createNodeBuildJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  const buildConfig = context.build.config;

  if (!isOfBuildType(buildConfig, "node", "node-static", "storybook")) {
    throw new Error("deploy config is not node, node-static or storybook");
  }

  const defaultImage = getRunnerImage("jobs-default");
  const yarnInstall = getYarnInstall(context.build);

  return createBuildJobs(context, {
    appBuild:
      buildConfig.buildCommand !== null
        ? {
            image: buildConfig.jobImage ?? defaultImage,
            runnerVariables: NODE_RUNNER_BUILD_VARIABLES,
            cache: [
              ...(ensureArray(buildConfig.jobCache) ?? []),
              ...getNodeCache(context.build),
              ...getNextCache(context),
            ],
            script: [
              ...yarnInstall,
              ...(ensureArray(buildConfig.buildCommand) ?? []),
            ],
            artifacts: {
              paths: [
                context.build.dir,
                // also copy workspace dependencies in monorepo if packages are shared and they create build artifacts
                ...(context.build.packageManagerInfo
                  ?.currentWorkspaceDependencies ?? []),
              ].flatMap((dir) => [
                join(dir, "__build_info.json"),
                join(dir, "dist"),
                join(dir, ".next"),
                ...(buildConfig.artifactsPaths?.map((path) =>
                  join(dir, path),
                ) ?? []),
              ]),
              expire_in: "1 day",
              when: "always",
            },
            jobTags: buildConfig.jobTags,
          }
        : undefined,

    dockerBuild: {
      script: getDockerBuildScriptWithBuiltInDockerFile(
        context,
        buildConfig.type === "node-static" || buildConfig.type === "storybook"
          ? "nginx"
          : "node",
      ),
      cache: [...getYarnCache(context.build, "pull")],
      variables: {
        // only required for non static
        DOCKER_COPY_AND_INSTALL_APP: getDockerAppCopyAndBuildScript(
          context.build,
        ),
        DOCKER_COPY_WORKSPACE_FILES:
          context.build.packageManagerInfo?.pathsToCopyInDocker
            .map((dir) => `COPY --chown=node:node ${dir} /app/${dir}`)
            ?.join("\n"),
      },
    },
  });
};
