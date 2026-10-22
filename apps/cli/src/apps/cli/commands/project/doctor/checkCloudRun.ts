import type { ComponentContext } from "@catladder/pipeline";
import {
  getManagedRuntimeServiceAccount,
  getManagedRuntimeServiceAccountEmail,
  getRuntimeServiceAccountRoles,
  isOfDeployType,
  readGcloudProjectNumber,
} from "@catladder/pipeline";
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
 *
 * Also audits the runtime identity: the managed runtime service account
 * must exist with its roles, and running as the default compute account
 * while that has `roles/editor`/`roles/owner` is flagged.
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

  await checkCloudRunRuntimeIdentity(report, inspector, cloudRunContexts);
};

const BROAD_ROLES = ["roles/editor", "roles/owner"];

type RuntimeIdentityResult =
  | { kind: "external"; email: string }
  | { kind: "managed"; email: string; exists: boolean; missingRoles: string[] }
  | { kind: "default"; email: string | null; broadRoles: string[] };

const inspectRuntimeIdentity = async (
  inspector: GcloudProjectInspector,
  context: ComponentContext,
): Promise<RuntimeIdentityResult> => {
  const config = getCloudRunConfig(context);
  if (typeof config.runtimeServiceAccount === "string") {
    return { kind: "external", email: config.runtimeServiceAccount };
  }
  if (getManagedRuntimeServiceAccount(config)) {
    const email = getManagedRuntimeServiceAccountEmail(
      context,
      config.projectId,
    );
    if (!(await accountExists(email))) {
      return { kind: "managed", email, exists: false, missingRoles: [] };
    }
    const boundRoles = await inspector.getRolesOfMember(
      config.projectId,
      `serviceAccount:${email}`,
    );
    const missingRoles = getRuntimeServiceAccountRoles(config).filter(
      (role) => !boundRoles.includes(role),
    );
    return { kind: "managed", email, exists: true, missingRoles };
  }
  const projectNumber = readGcloudProjectNumber(
    context.fullConfig,
    config.projectId,
  );
  if (!projectNumber) {
    return { kind: "default", email: null, broadRoles: [] };
  }
  const email = `${projectNumber}-compute@developer.gserviceaccount.com`;
  const boundRoles = await inspector.getRolesOfMember(
    config.projectId,
    `serviceAccount:${email}`,
  );
  return {
    kind: "default",
    email,
    broadRoles: BROAD_ROLES.filter((role) => boundRoles.includes(role)),
  };
};

/**
 * the identity the services and jobs run as (`runtimeServiceAccount`)
 */
export const checkCloudRunRuntimeIdentity = async (
  report: DoctorReport,
  inspector: GcloudProjectInspector,
  contexts: ComponentContext[],
) => {
  const results = await mapWithConcurrency(contexts, 5, async (context) => {
    try {
      return {
        context,
        result: await inspectRuntimeIdentity(inspector, context),
      };
    } catch (e) {
      return { context, error: e as Error };
    }
  });

  for (const { context, result, error } of results) {
    const label = `${context.env}:${context.name}`;
    if (error || !result) {
      report.warn(
        `${label}: could not inspect runtime service account (${error?.message})`,
      );
    } else if (result.kind === "external") {
      report.ok(`${label}: runs as ${result.email}`);
    } else if (result.kind === "managed") {
      if (!result.exists) {
        report.fail(
          `${label}: runtime service account ${result.email} does not exist`,
          `run: catladder project setup ${context.name}`,
        );
      } else if (result.missingRoles.length > 0) {
        report.fail(
          `${label}: runtime service account is missing roles: ${result.missingRoles.join(", ")}`,
          `run: catladder project setup ${context.name}`,
        );
      } else {
        report.ok(
          `${label}: runtime service account exists with all config-implied roles`,
        );
      }
    } else if (result.broadRoles.length > 0) {
      report.warn(
        `${label}: runs as the default compute service account ${result.email}, which has ${result.broadRoles.join(", ")}`,
        "set deploy.runtimeServiceAccount (e.g. { roles: [...] }) and run: catladder project setup",
      );
    } else {
      report.ok(
        `${label}: runs as the default compute service account${result.email ? "" : " (project number unknown, not inspected)"}`,
      );
    }
  }
};
