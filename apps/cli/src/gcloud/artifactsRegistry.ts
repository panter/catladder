import type { Gcloudregion } from "@catladder/pipeline";
import { exec } from "child-process-promise";

export const CATLADDER_REGISTRY_NAME = "catladder-deploy";

export const upsertGcloudArtifactsRegistry = async (config: {
  projectId: string;
  region: Gcloudregion;
}) => {
  try {
    await exec(
      `gcloud artifacts repositories create ${CATLADDER_REGISTRY_NAME} --project="${config.projectId}" --repository-format=docker --location=${config.region}`,
    );
  } catch (e) {
    // probably already exists
    //
  }
};
