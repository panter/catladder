import { join } from "path";
import { getRunnerImage } from "../../runner";
import type { GitlabJobCache } from "../../types";
import type { ComponentContext } from "../../types/context";

import type { CatladderJob } from "../../types/jobs";

import { createComponentBuildJobs } from "../base";
import { getDockerBuildScriptWithBuiltInDockerFile } from "../docker";
import { isOfBuildType } from "../types";
import { getNodeCache } from "./cache";
import { getYarnInstall } from "./yarn";

const getMeteorCache = (context: ComponentContext): GitlabJobCache[] => [
  {
    key: context.name + "-meteor-build-cache",
    policy: "pull-push",
    paths: [
      join(context.build.dir, ".meteor/local/resolver-result-cache.json"),
      join(context.build.dir, ".meteor/local/plugin-cache"),
      join(context.build.dir, ".meteor/local/isopacks"),
      join(context.build.dir, ".meteor/local/bundler-cache/scanner"),
    ],
  },
];
export const createMeteorBuildJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  const buildConfig = context.build.config;

  if (!isOfBuildType(buildConfig, "meteor")) {
    throw new Error("deploy config is not meteor");
  }

  const yarnInstall = getYarnInstall(context);

  return createComponentBuildJobs(context, {
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
          }
        : undefined,
    dockerBuild: {
      script: getDockerBuildScriptWithBuiltInDockerFile(context, "meteor"),
      variables: {
        METEOR_INSTALL_SCRIPTS: buildConfig.installScripts ? "true" : "",
      },
    },
  });
};
