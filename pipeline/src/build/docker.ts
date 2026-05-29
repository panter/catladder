import { existsSync } from "fs";
import { merge } from "lodash-es";
import path from "path";
import type { BuildConfig, BuildConfigDocker } from ".";
import { isOfDeployType } from "../deploy";
import {
  getArtifactsRegistryBuildCacheImage,
  getArtifactsRegistryHost,
  getArtifactsRegistryImageName,
} from "../deploy/cloudRun/artifactsRegistry";
import { gcloudServiceAccountLoginCommands } from "../deploy/cloudRun/utils/gcloudServiceAccountLoginCommands";
import { getRunnerImage } from "../runner";
import type {
  ComponentContext,
  ComponentContextWithBuild,
  DockerBuildJobDefinition,
} from "../types";
import type { CatladderJob } from "../types/jobs";
import { collapseableSection } from "../utils/gitlab";
import { createJobCacheFromCacheConfigs } from "./cache/createJobCache";

const DOCKER_BUILD_RUNNER_REQUESTS = {
  KUBERNETES_CPU_REQUEST: "0.45",
  KUBERNETES_MEMORY_REQUEST: "1Gi",
  KUBERNETES_MEMORY_LIMIT: "2Gi",
};

export const getDockerImageVariables = (context: ComponentContext) => {
  const deployConfig = context.deploy?.config;
  return {
    ...(isOfDeployType(deployConfig, "google-cloudrun")
      ? {
          DOCKER_REGISTRY: getArtifactsRegistryHost(context),
          DOCKER_IMAGE: getArtifactsRegistryImageName(context),
          DOCKER_CACHE_IMAGE: getArtifactsRegistryBuildCacheImage(context),
        }
      : // gitlab registry:
        {
          DOCKER_REGISTRY: "$CI_REGISTRY",

          DOCKER_CACHE_IMAGE: "$CI_REGISTRY_IMAGE/caches/" + context.name,
          // ONLY USED IN KUBERNETES
          DOCKER_IMAGE_NAME: context.env + "/" + context.name,
          DOCKER_IMAGE: "$CI_REGISTRY_IMAGE/$DOCKER_IMAGE_NAME",
        }),

    DOCKER_IMAGE_TAG: "$CI_COMMIT_SHA",
  };
};

/**
 * Weather the context requires a docker build
 */
export const requiresDockerBuild = (context: ComponentContext): boolean => {
  const deployConfig = context.deploy?.config;

  return (
    isOfDeployType(
      deployConfig,
      "kubernetes",
      "google-cloudrun",
      "dockerTag",
    ) ||
    (isOfDeployType(deployConfig, "custom") && deployConfig.requiresDocker)
  );
};

// those need to be runner variables
const getDockerBuildRunnerVariables = () => ({
  DOCKER_HOST: "tcp://docker:2375",
  DOCKER_TLS_CERTDIR: "",
  DOCKER_DRIVER: "overlay2",
  DOCKER_BUILDKIT: "1", // see https://docs.docker.com/develop/develop-images/build_enhancements/
});

const getDockerAdditions = (build: BuildConfig) => {
  if (!("docker" in build)) return {};
  if (!build.docker) return {};

  return {
    DOCKERFILE_ADDITIONS:
      "additionsBegin" in build.docker
        ? build.docker.additionsBegin?.join("\n")
        : undefined,
    DOCKERFILE_ADDITIONS_END:
      "additionsEnd" in build.docker
        ? build.docker.additionsEnd?.join("\n")
        : undefined,
  };
};
export const getDockerBuildVariables = (context: ComponentContextWithBuild) => {
  return {
    ...getDockerAdditions(context.build.config),
    APP_DIR: context.build.dir,
    DOCKER_BUILD_CONTEXT:
      "docker" in context.build.config &&
      context.build.config.docker &&
      "buildContextLocation" in context.build.config.docker &&
      context.build.config.docker?.buildContextLocation === "component"
        ? context.build.dir
        : ".",

    ...getDockerImageVariables(context),
  };
};

export const DOCKER_BUILD_JOB_NAME = "🔨 docker";

export const getDockerJobBaseProps = (): Pick<
  CatladderJob,
  "image" | "services" | "variables" | "runnerVariables"
> => {
  return {
    image: getRunnerImage("docker-build"),
    services: [
      {
        name: "docker:29.5.1-dind", // see see https://gitlab.com/gitlab-org/gitlab-runner/-/issues/27300#note_466755332
        command: ["--tls=false", "--registry-mirror=https://mirror.gcr.io"],
      },
    ],
    variables: {},
    runnerVariables: getDockerBuildRunnerVariables(),
  };
};

export const createDockerBuildJobBase = (
  context: ComponentContextWithBuild,
  { script, cache, ...def }: DockerBuildJobDefinition,
): CatladderJob => {
  return merge(
    {
      name: DOCKER_BUILD_JOB_NAME,
      envMode: "jobPerEnv",
      stage: "build",
      cache: cache ? createJobCacheFromCacheConfigs(context, cache) : undefined,
      ...getDockerJobBaseProps(),
      script: script || [],
    },
    {
      variables: getDockerBuildVariables(context),
      runnerVariables: {
        ...DOCKER_BUILD_RUNNER_REQUESTS,
        ...getDockerBuildRunnerVariables(),
      },
    },
    def,
  );
};

export const gitlabDockerLogin = (context: ComponentContext) =>
  context.deploy && isOfDeployType(context.deploy.config, "google-cloudrun")
    ? [
        ...gcloudServiceAccountLoginCommands(context),
        `gcloud auth configure-docker ${getArtifactsRegistryHost(context)}`,
      ]
    : [
        "docker login --username gitlab-ci-token --password $CI_JOB_TOKEN $CI_REGISTRY",
      ];

const BUILT_IN_ENSURE_DOCKERFILE_SCRIPTS = {
  meteor: "ensureMeteorDockerfile",
  node: "ensureNodeDockerfile",
  nginx: "ensureNginxDockerfile",
  custom: null,
} satisfies {
  [type in BuildConfigDocker["type"]]: string | null;
};

const getEnsureDockerFileScript = (
  context: ComponentContextWithBuild,
  fallbackType?: BuildConfigDocker["type"],
) => {
  if (
    "docker" in context.build.config &&
    context.build.config.docker &&
    "type" in context.build.config.docker
  ) {
    if (context.build.config.docker?.type === "custom") {
      if (context.build.config.docker?.dockerfileContent) {
        // we need to create a script that creates a Dockerfile in the current directory
        return `
echo "Creating Dockerfile"
cat >$APP_DIR/Dockerfile <<EOF
${context.build.config.docker?.dockerfileContent?.join("\n")}
EOF`;
      }
    }

    const type = context.build.config.docker?.type ?? fallbackType;
    return type ? BUILT_IN_ENSURE_DOCKERFILE_SCRIPTS[type] : null;
  }
  return fallbackType ? BUILT_IN_ENSURE_DOCKERFILE_SCRIPTS[fallbackType] : null;
};

export const getDockerBuildScriptWithBuiltInDockerFile = (
  context: ComponentContextWithBuild,
  fallbackType?: BuildConfigDocker["type"],
) => {
  return getDockerBuildDefaultScript(
    context,
    getEnsureDockerFileScript(context, fallbackType),
  );
};
export const getDockerBuildDefaultScript = (
  context: ComponentContext,
  ensureDockerFileScript?: string | null,
) =>
  [
    ensureDockerFileScript ?? undefined,
    ...collapseableSection(
      "docker-login",
      "Docker Login",
    )(gitlabDockerLogin(context)),
    ...collapseableSection(
      "docker-build",
      "Docker build",
    )([
      "docker build --network host --cache-from $DOCKER_CACHE_IMAGE --tag $DOCKER_IMAGE:$DOCKER_IMAGE_TAG -f $APP_DIR/Dockerfile $DOCKER_BUILD_CONTEXT --build-arg BUILDKIT_INLINE_CACHE=1", //BUILDKIT_INLINE_CACHE,  see https://testdriven.io/blog/faster-ci-builds-with-docker-cache/
    ]),
    ...collapseableSection(
      "docker-push",
      "Docker push and tag",
    )([
      "docker push $DOCKER_IMAGE:$DOCKER_IMAGE_TAG",
      "docker tag $DOCKER_IMAGE:$DOCKER_IMAGE_TAG $DOCKER_CACHE_IMAGE",
      "docker push $DOCKER_CACHE_IMAGE",
    ]),
  ].filter(Boolean);

export const hasDockerfile = (context: ComponentContext) =>
  existsSync(path.join(context.build.dir, "Dockerfile"));
