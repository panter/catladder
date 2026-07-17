import type { ComponentContext } from "@catladder/pipeline";
import {
  GCLOUD_DEPLOY_CREDENTIALS_KEY,
  isOfDeployType,
} from "@catladder/pipeline";

import type { IO } from "../../../../../core/types";
import { upsertGcloudArtifactsRegistry } from "../../../../../gcloud/artifactsRegistry";
import { enableGCloudServices } from "../../../../../gcloud/enableServices";
import { fetchGcloudProjectNumber } from "../../../../../gcloud/getProjectNumber";
import { upsertGcloudServiceAccountAndSaveSecret } from "../../../../../gcloud/serviceAccounts";
import { updateCatladderStore } from "../../../../../store/updateCatladderStore";

export const setupCloudRun = async (
  instance: IO,
  context: ComponentContext,
) => {
  if (!isOfDeployType(context.deploy?.config, "google-cloudrun")) {
    throw new Error("deploy config is not of type 'google-cloudrun'");
  }

  const config = context.deploy?.config;

  // enable services

  instance.log("enable required services...");
  await enableGCloudServices(
    [
      "run.googleapis.com",
      "artifactregistry.googleapis.com",
      "cloudscheduler.googleapis.com", // for scheduling jobs
      "cloudresourcemanager.googleapis.com", // only required to get google cloud project number
      ...(config.cloudSql
        ? ["sqladmin.googleapis.com", "sql-component.googleapis.com"]
        : []),
    ],
    config,
  );
  instance.log("upsert artifacts registry...");
  await upsertGcloudArtifactsRegistry(config);

  instance.log("upsert deploy service account...");
  await upsertGcloudServiceAccountAndSaveSecret(
    instance,
    context,
    {
      projectId: config.projectId,
      displayName: "Catladder gcloud deploy",
      description: "This service account deploys to google cloud",
      name: "cl-d",
      // TODO: run.admin is a bit much, would be better to follow https://stackoverflow.com/questions/55788714/deploying-to-cloud-run-with-a-custom-service-account-failed-with-iam-serviceacco
      roles: [
        "roles/artifactregistry.repoAdmin",
        "roles/run.admin",
        "roles/iam.serviceAccountUser",
        "roles/cloudscheduler.admin", // for scheduling
        ...(config.cloudSql ? ["roles/cloudsql.admin"] : []),
      ],
    },
    GCLOUD_DEPLOY_CREDENTIALS_KEY,
  );

  // the project number is needed at generation time to construct cloud
  // run's deterministic urls (<service>-<projectNumber>.<region>.run.app)
  instance.log("fetch gcloud project number...");
  const projectNumber = await fetchGcloudProjectNumber(config.projectId);
  instance.log("project number: " + projectNumber);

  await updateCatladderStore((store) => ({
    ...store,
    gcloudProjects: {
      ...store.gcloudProjects,
      [config.projectId]: { projectNumber },
    },
  }));
};
