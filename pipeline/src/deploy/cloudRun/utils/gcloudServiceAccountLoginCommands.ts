import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from "..";
import { getSecretVarNameForContext } from "../../../context";
import type { Context } from "../../../types";

export const gcloudServiceAccountLoginCommands = (context: Context) => {
  return [
    `echo $${getSecretVarNameForContext(
      context,
      GCLOUD_DEPLOY_CREDENTIALS_KEY
    )} > ./____keyfile.json
          `,
    `gcloud auth activate-service-account --key-file="./____keyfile.json"`,
  ];
};
