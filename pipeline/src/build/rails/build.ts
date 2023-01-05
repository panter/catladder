import type { Context } from "../..";
import type { CatladderJob } from "../../types/jobs";
import { createDockerBuildJobBase, gitlabDockerLogin } from "../docker";

export const createRailsBuildJobs = (context: Context): CatladderJob[] => {
  return [
    createDockerBuildJobBase(context, {
      variables: {
        CNB_BUILDER: "heroku/buildpacks:18",
        CNB_ENV_VARS: "BUNDLE_GIT__PANTER__CH",
        CNB_EXTRA_ARGS: "",
        CNB_PACK_VERSION: "0.20.0",
        ...context.componentConfig.build.extraVars,
      },
      // custom script
      script: [
        gitlabDockerLogin,
        `docker pull $DOCKER_CACHE_IMAGE || true`,
        `wget --output-document=- https://github.com/buildpacks/pack/releases/download/v$CNB_PACK_VERSION/pack-v$CNB_PACK_VERSION-linux.tgz | tar -zx --directory /usr/local/bin pack`,
        `chmod +x /usr/local/bin/pack`,
        //  replace private git ssh gem sources with https to make bundler with credentials via env var work
        `sed --in-place 's|git@\\([^:]*\\):|https://\\1/|g' Gemfile Gemfile.lock`,
        `for v in $CNB_ENV_VARS; do env_args="$env_args --env $v"; done`,
        `pack build $DOCKER_IMAGE:$DOCKER_IMAGE_TAG --builder $CNB_BUILDER --publish --cache-image $DOCKER_CACHE_IMAGE $env_args $CNB_EXTRA_ARGS`,
      ],
    }),
  ];
};
