import { join } from "path";
import { getRunnerImage } from "../../runner";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray } from "../../utils";
import { createBuildJobs } from "../base";
import { getDockerBuildDefaultScript, requiresDockerBuild } from "../docker";
import { isOfBuildType } from "../types";
import { getNextCache, getNodeCache, getYarnCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import { getDockerAppCopyAndBuildScript, getYarnInstall } from "./yarn";

export const createNodeBuildJobs = (context: Context): CatladderJob[] => {
  const buildConfig = context.componentConfig.build;

  if (!isOfBuildType(buildConfig, "node", "node-static", "storybook")) {
    throw new Error("deploy config is not node, node-static or storybook");
  }

  const defaultImage = getRunnerImage("jobs-default");
  const yarnInstall = getYarnInstall(context);

  return createBuildJobs(context, {
    appBuild:
      buildConfig.buildCommand !== null
        ? {
            image: buildConfig.jobImage ?? defaultImage,
            variables: {
              ...NODE_RUNNER_BUILD_VARIABLES,
            },
            cache: [
              ...(ensureArray(buildConfig.jobCache) ?? []),
              ...getNodeCache(context),
              ...getNextCache(context),
            ],
            script: [
              ...yarnInstall,
              ...(ensureArray(buildConfig.buildCommand) ?? []),
            ],
            artifacts: {
              paths: [
                join(context.componentConfig.dir, "__build_info.json"),
                join(context.componentConfig.dir, "dist"),
                join(context.componentConfig.dir, ".next"),
                ...(buildConfig.artifactsPaths?.map((path) =>
                  join(context.componentConfig.dir, path)
                ) ?? []),
              ],
              expire_in: "1 day",
            },
            jobTags: buildConfig.jobTags,
          }
        : undefined,

    dockerBuild: {
      script: getDockerBuildDefaultScript(
        buildConfig.type === "node-static" || buildConfig.type === "storybook"
          ? "ensureNginxDockerfile"
          : "ensureNodeDockerfile"
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
    },
  });
};
