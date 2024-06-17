import { getDockerJobBaseProps, gitlabDockerLogin } from "../../build/docker";

import type { ComponentContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createDeployementJobs } from "../base";
import { isOfDeployType } from "../types";

export const createDockerTagDeployJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "dockerTag")) {
    // should not happen
    throw new Error("deploy config is not dockerTag");
  }
  const tag = deployConfig.tag;
  return createDeployementJobs(context, {
    deploy: {
      ...getDockerJobBaseProps(),
      script: [
        ...gitlabDockerLogin(context),
        `docker pull $DOCKER_IMAGE:$DOCKER_IMAGE_TAG`,
        `docker tag $DOCKER_IMAGE:$DOCKER_IMAGE_TAG $DOCKER_IMAGE:${tag}`,
        `docker push $DOCKER_IMAGE:${tag}`,
        `echo "pushed as $DOCKER_IMAGE:${tag}"`,
      ],
    },
  });
};
