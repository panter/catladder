import type { ComponentContext } from "../..";
import type { CatladderJob } from "../../types/jobs";
import { createBuildJobs } from "../base";
import {
  getDockerBuildDefaultScript,
  gitlabDockerLogin,
  hasDockerfile,
} from "../docker";
import { isOfBuildType } from "../types";

export const createRailsBuildJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  const buildConfig = context.componentConfig.build;
  if (!isOfBuildType(buildConfig, "rails")) {
    // should not happen
    throw new Error("build type is not rails");
  }

  if (hasDockerfile(context)) {
    return createBuildJobs(context, {
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
  return createBuildJobs(context, {
    appBuild: undefined,
    dockerBuild: {
      variables: {
        ...context.environment.jobOnlyVars.build.envVars,
        ...context.componentConfig.build.extraVars,
      },
      // custom script
      script: [
        ...gitlabDockerLogin(context),
        `cd ${context.componentConfig.dir}`,
        `docker pull $DOCKER_CACHE_IMAGE || true`,
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
