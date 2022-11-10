import type { Context } from "@catladder/pipeline";
import {
  GCLOUD_DEPLOY_CREDENTIALS_KEY,
  GCLOUD_RUN_CANONICAL_HOST_SUFFIX,
  isOfDeployType,
} from "@catladder/pipeline";

import type { CommandInstance } from "vorpal";
import { upsertGcloudArtifactsRegistry } from "../../../../../gcloud/artifactsRegistry";
import { getCloudRunDomainSuffix } from "../../../../../gcloud/cloudRun/getCloudRunDomainSuffix";
import { enableGCloudServices } from "../../../../../gcloud/enableServices";
import { upsertGcloudServiceAccountAndSaveSecret } from "../../../../../gcloud/serviceAccounts";
import { upsertAllVariables } from "../../../../../utils/gitlab";

export const setupCloudRun = async (
  instance: CommandInstance,
  context: Context
) => {
  if (!isOfDeployType(context.componentConfig.deploy, "google-cloudrun")) {
    throw new Error("deploy config is not of type 'google-cloudrun'");
  }

  const config = context.componentConfig.deploy;

  // enable services

  instance.log("enable required servies...");
  await enableGCloudServices(
    [
      "run.googleapis.com",
      "artifactregistry.googleapis.com",
      ...(config.cloudSql
        ? ["sqladmin.googleapis.com", "sql-component.googleapis.com"]
        : []),
    ],
    config
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
        ...(config.cloudSql ? ["roles/cloudsql.admin"] : []),
      ],
    },
    GCLOUD_DEPLOY_CREDENTIALS_KEY
  );

  // gcloud run automatically gives us a hostname
  // but the pipeline need to know it before deployment
  // so we get this through some magic and add this as a ci/cd variable
  // the pipeline than can use this to construct the canonical host
  instance.log(
    "get service domain suffix... that might take a while initially"
  );
  const suffix = await getCloudRunDomainSuffix(config);
  instance.log("domain suffix: " + suffix);

  await upsertAllVariables(
    instance,
    {
      [GCLOUD_RUN_CANONICAL_HOST_SUFFIX]: suffix,
    },
    context.environment.shortName,
    context.componentName,
    false, // backup
    false // masked
  );
};
