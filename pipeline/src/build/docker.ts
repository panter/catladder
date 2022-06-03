import { merge } from "lodash";
import { isOfDeployType } from "../deploy";
import { getRunnerImage } from "../runner";
import { Context } from "../types";
import { CatladderJob } from "../types/jobs";

const DOCKER_RUNNER_BUILD_VARIABLES = {
  KUBERNETES_CPU_REQUEST: "0.5",
  KUBERNETES_CPU_LIMIT: "1",
  KUBERNETES_MEMORY_REQUEST: "1Gi",
  KUBERNETES_MEMORY_LIMIT: "2Gi",
};

export const getDockerImageVariables = (context: Context) => {
  return {
    DOCKER_REGISTRY: "$CI_REGISTRY",
    DOCKER_REGISTRY_IMAGE_PATH: "$CI_REGISTRY_IMAGE",
    DOCKER_CACHE_IMAGE:
      "$DOCKER_REGISTRY_IMAGE_PATH/caches/" + context.componentName,
    DOCKER_IMAGE_NAME:
      context.environment.shortName + "/" + context.componentName,
    DOCKER_IMAGE: "$DOCKER_REGISTRY_IMAGE_PATH/$DOCKER_IMAGE_NAME",
    DOCKER_IMAGE_TAG: "$CI_COMMIT_SHA",
  };
};

export const requiresDockerBuild = (context: Context) => {
  const deployConfig = context.componentConfig.deploy;
  if (isOfDeployType(deployConfig, "kubernetes")) {
    return true;
  }

  if (isOfDeployType(deployConfig, "custom") && deployConfig.requiresDocker) {
    return true;
  }

  return false;
};

export const getDockerBuildVariables = (context: Context) => {
  return {
    ...DOCKER_RUNNER_BUILD_VARIABLES,
    DOCKER_BUILDKIT: "1", // see https://docs.docker.com/develop/develop-images/build_enhancements/
    DOCKERFILE_ADDITIONS:
      context.componentConfig.build.docker?.additionsBegin?.join("\n"),
    DOCKERFILE_ADDITIONS_END:
      context.componentConfig.build.docker?.additionsEnd?.join("\n"),
    APP_DIR: context.componentConfig.dir,
    DOCKER_HOST: "tcp://0.0.0.0:2375",
    DOCKER_TLS_CERTDIR: "",
    DOCKER_DIR: ".", // relative to componentdir

    DOCKER_DRIVER: "overlay2",

    ...getDockerImageVariables(context),
  };
};

export const DOCKER_BUILD_JOB_NAME = "🔨 docker";

export const createDockerBuildJobBase = (
  context: Context,
  { script, variables, ...def }: Partial<CatladderJob>
): CatladderJob => {
  return merge(
    {
      name: DOCKER_BUILD_JOB_NAME,
      envMode: "jobPerEnv",
      stage: "build",
      image: getRunnerImage("docker-build"),

      services: [
        {
          name: "docker:20-dind", // see see https://gitlab.com/gitlab-org/gitlab-runner/-/issues/27300#note_466755332
          command: ["--tls=false"],
        },
      ],
      variables: {
        ...getDockerBuildVariables(context),
        ...(variables ?? {}),
      },
      script: script || [],
    },
    def
  );
};

export const createDockerBuildJobDefault = (
  context: Context,
  { script, ...def }: Partial<CatladderJob>
): CatladderJob => {
  return createDockerBuildJobBase(context, {
    script: [
      ...(script || []),
      "docker login --username gitlab-ci-token --password $CI_JOB_TOKEN $CI_REGISTRY",
      "docker build --network host --cache-from $DOCKER_CACHE_IMAGE --tag $DOCKER_IMAGE:$DOCKER_IMAGE_TAG -f $APP_DIR/Dockerfile . --build-arg BUILDKIT_INLINE_CACHE=1", //BUILDKIT_INLINE_CACHE,  see https://testdriven.io/blog/faster-ci-builds-with-docker-cache/
      "docker push $DOCKER_IMAGE:$DOCKER_IMAGE_TAG",
      "docker tag $DOCKER_IMAGE:$DOCKER_IMAGE_TAG $DOCKER_CACHE_IMAGE",
      "docker push $DOCKER_CACHE_IMAGE",
    ],
    ...def,
  });
};
