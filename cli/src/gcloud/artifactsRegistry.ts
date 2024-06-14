import type { Gcloudregion } from "@catladder/pipeline";
import { exec } from "child-process-promise";

export const upsertGcloudArtifactsRegistry = async (config: {
  projectId: string;
  region: Gcloudregion;
}) => {
  try {
    await exec(
      `gcloud artifacts repositories create catladder-deploy --project="${config.projectId}" --repository-format=docker --location=${config.region}`,
    );
  } catch (e) {
    // probably already exists
    //
  }
};
