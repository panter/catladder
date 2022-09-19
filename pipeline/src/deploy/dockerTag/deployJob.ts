import { merge } from "lodash";
import { getDockerJobBaseProps, gitlabDockerLogin } from "../../build/docker";

import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { getBaseDeploymentJob } from "../base";
import { isOfDeployType } from "../types";

export const createDockerTagDeployJobs = (context: Context): CatladderJob[] => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "dockerTag")) {
    // should not happen
    throw new Error("deploy config is not dockerTag");
  }
  const baseDeploymentJob = getBaseDeploymentJob(context);
  const tag = deployConfig.tag;
  return [
    merge({}, baseDeploymentJob, getDockerJobBaseProps(context), {
      script: [
        gitlabDockerLogin,
        `docker pull $DOCKER_IMAGE:$DOCKER_IMAGE_TAG`,
        `docker tag $DOCKER_IMAGE:$DOCKER_IMAGE_TAG $DOCKER_IMAGE:${tag}`,
        `docker push $DOCKER_IMAGE:${tag}`,
        `echo "pushed as $DOCKER_IMAGE:${tag}"`,
      ],
    }),
  ];
};
