import { join } from "path";
import { getRunnerImage } from "../../runner";
import type { GitlabJobCache } from "../../types";
import type { Context } from "../../types/context";

import type { CatladderJob } from "../../types/jobs";

import { createBuildJobs } from "../base";
import { getDockerBuildDefaultScript } from "../docker";
import { isOfBuildType } from "../types";
import { getNodeCache } from "./cache";
import { getYarnInstall } from "./yarn";

const getMeteorCache = (context: Context): GitlabJobCache[] => [
  {
    key: context.componentName + "meteor-build-cache",
    policy: "pull-push",
    paths: [
      join(
        context.componentConfig.dir,
        ".meteor/local/resolver-result-cache.json"
      ),
      join(context.componentConfig.dir, ".meteor/local/plugin-cache"),
      join(context.componentConfig.dir, ".meteor/local/isopacks"),
      join(context.componentConfig.dir, ".meteor/local/bundler-cache/scanner"),
    ],
  },
];
export const createMeteorBuildJobs = (context: Context): CatladderJob[] => {
  const buildConfig = context.componentConfig.build;

  if (!isOfBuildType(buildConfig, "meteor")) {
    throw new Error("deploy config is not meteor");
  }

  const yarnInstall = getYarnInstall(context);

  return createBuildJobs(context, {
    appBuild:
      buildConfig.buildCommand !== null
        ? {
            cache: [...getNodeCache(context), ...getMeteorCache(context)],
            image: getRunnerImage("jobs-meteor"),
            variables: {
              METEOR_DISABLE_OPTIMISTIC_CACHING: "1", // see https://forums.meteor.com/t/veeery-long-building-time-inside-docker-container/58673/17?u=macrozone
            },
            script: [
              ...yarnInstall,

              'echo "add healthcheck package"',
              "meteor add panter:healthroute --allow-superuser",
              "meteor add qualia:prod-shell --allow-superuser",

              'TOOL_NODE_FLAGS="--max_old_space_size=3584 --min_semi_space_size=8 --max_semi_space_size=256 --optimize_for_size" meteor build ./dist --architecture os.linux.x86_64 --allow-superuser --server-only --directory',

              "cp ./__build_info.json ./dist/bundle/programs/server",
            ],
            artifacts: {
              paths: [
                context.componentConfig.dir + "/__build_info.json",
                context.componentConfig.dir + "/dist",
              ],
            },
          }
        : undefined,
    dockerBuild: {
      script: getDockerBuildDefaultScript("ensureMeteorDockerfile"),
      variables: {
        METEOR_INSTALL_SCRIPTS: buildConfig.installScripts ? "true" : "",
      },
    },
  });
};
