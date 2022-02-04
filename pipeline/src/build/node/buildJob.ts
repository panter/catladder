import { Context } from "../../types/context";
import { GitlabJob, GitlabJobs } from "../../types/gitlab-types";
import { ensureArray } from "../../utils";
import { APP_BUILD_JOB_NAME } from "../base/constants";
import { createBuildJob } from "../base/createBuildJob";
import { createDockerBuildJob, DOCKER_BUILD_JOB_NAME } from "../docker";
import { isOfBuildType } from "../types";
import { getNextCache, getNodeCache } from "./cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "./constants";
import { getYarnInstall } from "./yarn";

export const createNodeBuildJobs = (context: Context): GitlabJobs => {
  const buildConfig = context.componentConfig.build;

  if (!isOfBuildType(buildConfig, "node", "node-static", "storybook")) {
    throw new Error("deploy config is not node, node-static or storybook");
  }

  const yarnInstall = getYarnInstall(context);
  const appBuildJob: GitlabJob | null =
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
              context.componentConfig.dir + "/__build_info.json",
              context.componentConfig.dir + "/dist",
              context.componentConfig.dir + "/.next",
            ],
          },
        })
      : null;
  return [
    ...(appBuildJob ? [appBuildJob] : []),
    {
      name: DOCKER_BUILD_JOB_NAME,
      envMode: "jobPerEnv",
      job: {
        ...createDockerBuildJob(context, {
          script: [
            buildConfig.type === "node-static" ||
            buildConfig.type === "storybook"
              ? "ensureNginxDockerfile"
              : "ensureNodeDockerfile",
          ],
        }),
        needs: appBuildJob ? [APP_BUILD_JOB_NAME] : [],
      },
    },
  ];
};
