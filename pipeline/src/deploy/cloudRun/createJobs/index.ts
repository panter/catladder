import { merge } from "lodash";

import { getDockerJobBaseProps } from "../../../build/docker";
import { getRunnerImage } from "../../../runner";
import type { Context } from "../../../types/context";
import type { CatladderJob } from "../../../types/jobs";
import { allowFailureInScripts } from "../../../utils/gitlab";
import { createDeployementJobs } from "../../base";

import { isOfDeployType } from "../../types";
import { getDeployJobVariables } from "./variables";
import { getCloudRunDeployScripts } from "./getCloudRunDeployScripts";
import { getCloudRunStopScripts } from "./getCloudRunStopScripts";

export const createGoogleCloudRunDeployJobs = (
  context: Context
): CatladderJob[] => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }

  const deployScripts = getCloudRunDeployScripts(context);
  const stopScripts = getCloudRunStopScripts(context);

  return createDeployementJobs(context, {
    deploy: merge(getDockerJobBaseProps(context), {
      artifacts: { paths: ["____envvars.yaml"] },
      variables: getDeployJobVariables(context),
      image: getRunnerImage("gcloud"),
      script: deployScripts,
    }),
    stop: {
      image: getRunnerImage("gcloud"),
      variables: {
        CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
      },
      script: allowFailureInScripts(stopScripts),
    },
  });
};
