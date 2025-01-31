import type { ComponentContextWithBuild } from "../..";
import { componentContextIsStandaloneBuild } from "../..";
import type { CatladderJob } from "../../types/jobs";
import { createComponentBuildJobs } from "../base";
import {
  getDockerBuildDefaultScript,
  gitlabDockerLogin,
  hasDockerfile,
} from "../docker";
import { isOfBuildType } from "../types";

export const createRailsBuildJobs = (
  context: ComponentContextWithBuild,
): CatladderJob[] => {
  const buildConfig = context.build.config;
  if (!isOfBuildType(buildConfig, "rails")) {
    // should not happen
    throw new Error("build type is not rails");
  }

  // if its not a standalone build, we don't need to run tests
  if (!componentContextIsStandaloneBuild(context)) {
    throw new Error("workspace builds are not supported for rails apps");
  }

  if (hasDockerfile(context)) {
    return createComponentBuildJobs(context, {
      appBuild: undefined,
      dockerBuild: {
        script: getDockerBuildDefaultScript(context),
        variables: {},
      },
    });
  }

  const cnbConf = buildConfig.cnbBuilder;

  const packEnvArgs = Object.entries(cnbConf?.buildVars ?? {})
    .map(([k, v]) => `--env '${k}${v ? `=${v}` : ""}'`)
    .join(" ");
  return createComponentBuildJobs(context, {
    appBuild: undefined,
    dockerBuild: {
      variables: {
        ...context.environment.jobOnlyVars.build.envVars,
      },
      // custom script
      script: [
        ...gitlabDockerLogin(context),
        `cd ${context.build.dir}`,
        `wget --output-document=- https://github.com/buildpacks/pack/releases/download/v${cnbConf?.packVersion}/pack-v${cnbConf?.packVersion}-linux.tgz | tar -zx --directory /usr/local/bin pack`,
        `chmod +x /usr/local/bin/pack`,
        //  replace private git ssh gem sources with https to make bundler with credentials via env var work
        `sed --in-place 's|git@\\([^:]*\\):|https://\\1/|g' Gemfile Gemfile.lock`,
        `pack build "$DOCKER_IMAGE:$DOCKER_IMAGE_TAG" --builder '${
          cnbConf?.image
        }' --publish --cache-image "$DOCKER_CACHE_IMAGE" ${packEnvArgs} ${
          cnbConf?.packExtraArgs?.join(" ") ?? ""
        }`,
      ],
    },
  });
};
