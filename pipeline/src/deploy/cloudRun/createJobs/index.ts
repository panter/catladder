import type { ComponentContext } from "../../../types/context";
import type { CatladderJob } from "../../../types/jobs";
import { allowFailureInScripts } from "../../../utils/gitlab";
import { createDeployementJobs } from "../../base";

import { isOfDeployType } from "../../types";
import { CLOUD_SDK_IMAGE, ENV_VARS_FILENAME } from "./constants";
import { getCloudRunDeployScripts } from "./getCloudRunDeployScripts";
import { getCloudRunStopScripts } from "./getCloudRunStopScripts";

export const createGoogleCloudRunDeployJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }

  const deployScripts = getCloudRunDeployScripts(context);
  const stopScripts = getCloudRunStopScripts(context);

  return createDeployementJobs(context, {
    deploy: {
      variables: {
        CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
      },
      ...(deployConfig.debug
        ? {
            artifacts: {
              paths: [
                ENV_VARS_FILENAME, // debug
              ],
              when: "always",
            },
          }
        : {}),

      image: CLOUD_SDK_IMAGE,
      script: deployScripts,
    },
    stop: {
      image: CLOUD_SDK_IMAGE,
      variables: {
        CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
      },
      script: allowFailureInScripts(stopScripts),
    },
  });
};
