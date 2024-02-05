import { dump } from "js-yaml";
import { omit } from "lodash";

import type { Context } from "../../../types/context";

import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from "../../..";

export function getDeployJobVariables(context: Context) {
  const allEnvVars = omit(
    context.environment.envVars,
    GCLOUD_DEPLOY_CREDENTIALS_KEY
  );
  return {
    CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
    ENV_VARS: dump(allEnvVars, {
      lineWidth: -1,
      quotingType: "'",
      forceQuotes: true,
    }),
  };
}
