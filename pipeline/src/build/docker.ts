import { getRunnerImage } from "../runner";
import { GitlabJobDef, Context } from "../types";

const DOCKER_RUNNER_BUILD_VARIABLES = {
  KUBERNETES_CPU_REQUEST: "0.5",
  KUBERNETES_CPU_LIMIT: "1",
  KUBERNETES_MEMORY_REQUEST: "1Gi",
  KUBERNETES_MEMORY_LIMIT: "2Gi",
};

export const DOCKER_BUILD_JOB_NAME = "🔨 docker";
export const createDockerBuildJob = (
  context: Context,
  { script }: Pick<GitlabJobDef, "script">
): GitlabJobDef => {
  const base: Omit<GitlabJobDef, "script"> = {
    stage: "build",
    image: getRunnerImage("docker-build"),
    interruptible: true,
    services: [
      {
        name: "docker:20-dind", // see see https://gitlab.com/gitlab-org/gitlab-runner/-/issues/27300#note_466755332
        command: ["--tls=false"],
      },
    ],
    variables: {
      ...DOCKER_RUNNER_BUILD_VARIABLES,
      APP_DIR: context.componentConfig.dir,
      DOCKER_HOST: "tcp://0.0.0.0:2375",
      DOCKER_TLS_CERTDIR: "",
      DOCKER_DIR: ".", // relative to componentdir
      IMAGE_TAG: "$CI_COMMIT_SHA",
      DOCKER_DRIVER: "overlay2",
      IMAGE_NAME: "$CI_REGISTRY_IMAGE/" + context.componentName,
      CACHE_IMAGE:
        "$CI_REGISTRY_IMAGE/" + context.componentName + "/cache:cache",
    },
  };

  return {
    ...base,
    script: [
      ...script,
      "docker login --username gitlab-ci-token --password $CI_JOB_TOKEN $CI_REGISTRY",
      "docker pull $CACHE_IMAGE || true",
      "docker build --network host --cache-from $CACHE_IMAGE --tag $IMAGE_NAME:$IMAGE_TAG -f $APP_DIR/Dockerfile .",
      "docker push $IMAGE_NAME:$IMAGE_TAG",
      "docker tag $IMAGE_NAME:$IMAGE_TAG $CACHE_IMAGE",
      "docker push $CACHE_IMAGE",
    ],
  };
};
