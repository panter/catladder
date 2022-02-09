import { Context } from "../..";
import { CatladderJob } from "../../types/jobs";
import { createDockerBuildJobBase } from "../docker";

export const createRailsBuildJobs = (context: Context): CatladderJob[] => {
  return [
    createDockerBuildJobBase(context, {
      variables: {
        CNB_BUILDER: "heroku/buildpacks:18",
        CNB_ENV_VARS: "BUNDLE_GIT__PANTER__CH",
        CNB_EXTRA_ARGS: "",
        CNB_PACK_VERSION: "0.20.0",
      },
      // custom script
      script: [
        `docker login --username gitlab-ci-token --password $CI_JOB_TOKEN $CI_REGISTRY`,
        `docker pull $CACHE_IMAGE || true`,
        `wget --output-document=- https://github.com/buildpacks/pack/releases/download/v$CNB_PACK_VERSION/pack-v$CNB_PACK_VERSION-linux.tgz | tar -zx --directory /usr/local/bin pack`,
        `chmod +x /usr/local/bin/pack`,
        //  replace private git ssh gem sources with https to make bundler with credentials via env var work
        // eslint-disable-next-line no-useless-escape
        `sed --in-place 's|git@\([^:]*\):|https://\1/|g' Gemfile Gemfile.lock`,
        `for v in $CNB_ENV_VARS; do env_args="$env_args --env $v"; done`,
        `pack build $IMAGE_NAME:$IMAGE_TAG --builder $CNB_BUILDER --publish --cache-image $CACHE_IMAGE $env_args $CNB_EXTRA_ARGS`,
      ],
    }),
  ];
};
