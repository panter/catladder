import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from "..";
import { getSecretVarNameForContext } from "../../../context";
import type { Context } from "../../../types";

export const gcloudServiceAccountLoginCommands = (context: Context) => [
  `gcloud auth activate-service-account --key-file=<(echo "$${getSecretVarNameForContext(
    context,
    GCLOUD_DEPLOY_CREDENTIALS_KEY
  )}")`,
];
