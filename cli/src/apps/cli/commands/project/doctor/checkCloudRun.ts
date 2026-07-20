import type { ComponentContext } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";
import { CATLADDER_REGISTRY_NAME } from "../../../../../gcloud/artifactsRegistry";
import { getGcloudServiceAccountNames } from "../../../../../gcloud/serviceAccountNames";
import { accountExists } from "../../../../../gcloud/serviceAccounts";
import { mapWithConcurrency } from "../../../../../utils/concurrency";
import {
  CLOUD_RUN_DEPLOY_SA_NAME,
  getCloudRunDeployRoles,
  getCloudRunRequiredServices,
} from "../setup/setupCloudRun";
import type { DoctorReport } from "./DoctorReport";
import { GcloudProjectInspector } from "./GcloudProjectInspector";

const getCloudRunConfig = (context: ComponentContext) => {
  const config = context.deploy?.config;
  if (!isOfDeployType(config, "google-cloudrun")) {
    throw new Error("not a cloud run context");
  }
  return config;
};

/**
 * compares the gcloud state `setupCloudRun` would provision for the
 * CURRENT config against what is actually there: enabled services and
 * artifacts registry per project, deploy service account existence and
 * IAM roles per component/env.
 *
 * The motivating case (#70): a component gets `cloudSql` after its
 * setup ran — deploys keep working and only the review teardown hits
 * the missing `roles/cloudsql.admin` as a 403 in ci.
 */
export const checkCloudRun = async (
  report: DoctorReport,
  contexts: ComponentContext[],
) => {
  const cloudRunContexts = contexts.filter((context) =>
    isOfDeployType(context.deploy?.config, "google-cloudrun"),
  );
  if (cloudRunContexts.length === 0) return;

  report.section("google cloud run infrastructure");
  const inspector = new GcloudProjectInspector();
  if (!(await inspector.isAuthenticated())) {
    report.fail(
      "gcloud is not authenticated — all google cloud checks skipped",
      "run: gcloud auth login",
    );
    return;
  }

  // project-level: enabled services + artifacts registry. The required
  // services are the union over all components deploying to the project
  // (cloudSql on any of them requires the sql services).
  const byProject = new Map<string, ComponentContext[]>();
  for (const context of cloudRunContexts) {
    const { projectId } = getCloudRunConfig(context);
    byProject.set(projectId, [...(byProject.get(projectId) ?? []), context]);
  }

  for (const [projectId, projectContexts] of byProject) {
    const requiredServices = new Set(
      projectContexts.flatMap((context) =>
        getCloudRunRequiredServices(getCloudRunConfig(context)),
      ),
    );
    try {
      const enabled = await inspector.getEnabledServices(projectId);
      const missing = [...requiredServices].filter(
        (service) => !enabled.has(service),
      );
      if (missing.length === 0) {
        report.ok(
          `${projectId}: all ${requiredServices.size} required services enabled`,
        );
      } else {
        report.fail(
          `${projectId}: services not enabled: ${missing.join(", ")}`,
          "run: catladder project setup",
        );
      }
    } catch (e) {
      report.warn(
        `${projectId}: could not list enabled services (${e.message})`,
      );
    }

    const regions = new Set(
      projectContexts.map((context) => getCloudRunConfig(context).region),
    );
    for (const region of regions) {
      if (await inspector.hasArtifactsRegistry(projectId, region)) {
        report.ok(
          `${projectId}: artifacts registry '${CATLADDER_REGISTRY_NAME}' exists in ${region}`,
        );
      } else {
        report.fail(
          `${projectId}: artifacts registry '${CATLADDER_REGISTRY_NAME}' missing in ${region}`,
          "run: catladder project setup",
        );
      }
    }
  }

  // per component/env: deploy service account exists and carries every
  // role the current config implies
  const results = await mapWithConcurrency(
    cloudRunContexts,
    5,
    async (context) => {
      const config = getCloudRunConfig(context);
      const { fullIdentifier } = getGcloudServiceAccountNames(context, {
        name: CLOUD_RUN_DEPLOY_SA_NAME,
        projectId: config.projectId,
      });
      if (!(await accountExists(fullIdentifier))) {
        return { context, fullIdentifier, exists: false, missingRoles: [] };
      }
      const boundRoles = await inspector.getRolesOfMember(
        config.projectId,
        `serviceAccount:${fullIdentifier}`,
      );
      const missingRoles = getCloudRunDeployRoles(config).filter(
        (role) => !boundRoles.includes(role),
      );
      return { context, fullIdentifier, exists: true, missingRoles };
    },
  );

  for (const { context, fullIdentifier, exists, missingRoles } of results) {
    const label = `${context.env}:${context.name}`;
    if (!exists) {
      report.fail(
        `${label}: deploy service account ${fullIdentifier} does not exist`,
        `run: catladder project setup ${context.name}`,
      );
    } else if (missingRoles.length > 0) {
      report.fail(
        `${label}: service account is missing roles: ${missingRoles.join(", ")}`,
        `run: catladder project setup ${context.name}`,
      );
    } else {
      report.ok(
        `${label}: service account exists with all config-implied roles`,
      );
    }
  }
};
