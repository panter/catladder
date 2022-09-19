import { exec } from "child-process-promise";

export const enableGCloudServices = async (
  services: string[],
  config: {
    projectId: string;
  }
) => {
  for (const service of services) {
    await exec(
      `gcloud services enable ${service} --project=${config.projectId}`
    );
  }
};
