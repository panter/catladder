import { exec } from "child-process-promise";

/**
 * resolves the numeric gcloud project number for a project id.
 * Requires `cloudresourcemanager.googleapis.com` to be enabled.
 */
export const fetchGcloudProjectNumber = async (
  projectId: string,
): Promise<string> => {
  const result = await exec(
    `gcloud projects describe ${projectId} --format="value(projectNumber)"`,
  );
  const projectNumber = result.stdout.trim();
  if (!/^\d+$/.test(projectNumber)) {
    throw new Error(
      `could not determine the gcloud project number for "${projectId}" (got: "${projectNumber}")`,
    );
  }
  return projectNumber;
};
