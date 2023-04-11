import type { Context } from "../../types/context";
import { ensureArray } from "../../utils";
import { APP_BUILD_JOB_NAME } from "../base/constants";
import { createBuildJob } from "../base/createBuildJob";
import { createDockerBuildJobDefault, requiresDockerBuild } from "../docker";
import { join } from "path";
import { isOfBuildType } from "../types";
import { getNextCache, getNodeCache, getYarnCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import { getDockerAppCopyAndBuildScript, getYarnInstall } from "./yarn";
import type { CatladderJob } from "../../types/jobs";

export const createNodeBuildJobs = (context: Context): CatladderJob[] => {
  const buildConfig = context.componentConfig.build;

  if (!isOfBuildType(buildConfig, "node", "node-static", "storybook")) {
    throw new Error("deploy config is not node, node-static or storybook");
  }

  const yarnInstall = getYarnInstall(context);
  const appBuildJob: CatladderJob | null =
    buildConfig.buildCommand !== null
      ? createBuildJob(context, {
          variables: {
            ...NODE_RUNNER_BUILD_VARIABLES,
          },
          cache: [...getNodeCache(context), ...getNextCache(context)],
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
          },
        })
      : null;
  return [
    ...(appBuildJob ? [appBuildJob] : []),
    ...(requiresDockerBuild(context)
      ? [
          createDockerBuildJobDefault(context, {
            script: [
              buildConfig.type === "node-static" ||
              buildConfig.type === "storybook"
                ? "ensureNginxDockerfile"
                : "ensureNodeDockerfile",
            ],
            cache: [...getYarnCache(context, "pull")],
            variables: {
              // only required for non static
              DOCKER_COPY_AND_INSTALL_APP:
                getDockerAppCopyAndBuildScript(context),
              DOCKER_COPY_WORKSPACE_FILES:
                context.packageManagerInfo?.pathsToCopyInDocker
                  .map((dir) => `COPY --chown=node:node ${dir} /app/${dir}`)
                  ?.join("\n"),
            },

            needs: appBuildJob ? [APP_BUILD_JOB_NAME] : [],
          }),
        ]
      : []),
  ];
};
