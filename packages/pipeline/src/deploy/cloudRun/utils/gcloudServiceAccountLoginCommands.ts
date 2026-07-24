import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from "..";
import { getSecretVarNameForContext } from "../../../context";
import type { ComponentContext } from "../../../types";

export const gcloudServiceAccountLoginCommands = (
  context: ComponentContext,
) => [
  `gcloud auth activate-service-account --key-file=<(echo "$${getSecretVarNameForContext(
    context,
    GCLOUD_DEPLOY_CREDENTIALS_KEY,
  )}")`,
];
