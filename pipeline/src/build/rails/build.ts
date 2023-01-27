import type { Context } from "../..";
import { isOfBuildType } from "../types";
import type { CatladderJob } from "../../types/jobs";
import { createDockerBuildJobBase, gitlabDockerLogin } from "../docker";

export const createRailsBuildJobs = (context: Context): CatladderJob[] => {
  const buildConfig = context.componentConfig.build
  if (!isOfBuildType(buildConfig, "rails")) {
    // should not happen
    throw new Error("build type is not rails");
  }

  const cnbConf = buildConfig.cnbBuilder;

  // backwards compatabilty with CNB_ENV_VARS
  // TODO: remove when all projects are migrated
  const packEnvArgs = buildConfig.extraVars?.CNB_ENV_VARS?.split(" ").map(v => `--env '${v}'`)
    ?? Object.entries(cnbConf?.buildVars ?? {}).map(([k, v]) => `--env '${k}${v ? `=${v}` : ""}'`)

  return [
    createDockerBuildJobBase(context, {
      variables: context.componentConfig.build.extraVars,
      // custom script
      script: [
        gitlabDockerLogin,
        `docker pull $DOCKER_CACHE_IMAGE || true`,
        `wget --output-document=- https://github.com/buildpacks/pack/releases/download/v${cnbConf?.packVersion}/pack-v${cnbConf?.packVersion}-linux.tgz | tar -zx --directory /usr/local/bin pack`,
        `chmod +x /usr/local/bin/pack`,
        //  replace private git ssh gem sources with https to make bundler with credentials via env var work
        `sed --in-place 's|git@\\([^:]*\\):|https://\\1/|g' Gemfile Gemfile.lock`,
        `pack build "$DOCKER_IMAGE:$DOCKER_IMAGE_TAG" --builder '${cnbConf?.image}' --publish --cache-image "$DOCKER_CACHE_IMAGE" ${packEnvArgs.join(" ")} ${cnbConf?.packExtraArgs?.join(" ") ?? ""}`
      ],
    }),
  ];
};
