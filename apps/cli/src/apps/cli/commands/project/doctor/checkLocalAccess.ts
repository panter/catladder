import type { ComponentContext, Config } from "@catladder/pipeline";
import {
  diffRoleBindings,
  getLocalAccessGcpCredentialsEnvVars,
  getLocalAccessGcpRoles,
  getVaultConfig,
  isOfDeployType,
} from "@catladder/pipeline";
import {
  getLocalAccessServiceAccountNames,
  listUserManagedKeyIds,
} from "../../../../../gcloud/localAccess";
import { accountExists } from "../../../../../gcloud/serviceAccounts";
import { mapWithConcurrency } from "../../../../../utils/concurrency";
import type { DoctorReport } from "./DoctorReport";
import type { GcloudProjectInspector } from "./GcloudProjectInspector";

/**
 * compares the read-only local access service accounts (`localAccess`
 * in catladder.ts) with their declaration: missing account, missing and
 * extra bindings, and an account that exists although nothing is
 * declared any more. Expects an authenticated inspector.
 */
export const checkLocalAccess = async (
  report: DoctorReport,
  config: Config,
  contexts: ComponentContext[],
  inspector: GcloudProjectInspector,
) => {
  const results = await mapWithConcurrency(contexts, 5, async (context) => {
    const deployConfig = context.deploy?.config;
    if (!isOfDeployType(deployConfig, "google-cloudrun")) return null;
    const label = `${context.env}:${context.name}`;
    let declared: string[];
    try {
      declared = getLocalAccessGcpRoles(config, context.env);
      getLocalAccessGcpCredentialsEnvVars(config, context.name);
    } catch (e) {
      return { label, invalid: e.message as string };
    }
    const { fullIdentifier } = getLocalAccessServiceAccountNames(
      context,
      deployConfig.projectId,
    );
    const exists = await accountExists(fullIdentifier);
    const member = `serviceAccount:${fullIdentifier}`;
    const bound = exists
      ? await inspector.getUnconditionalRolesOfMember(
          deployConfig.projectId,
          member,
        )
      : [];
    const conditional = exists
      ? await inspector.getConditionalRolesOfMember(
          deployConfig.projectId,
          member,
        )
      : [];
    const keyCount = exists
      ? (await listUserManagedKeyIds(fullIdentifier)).length
      : 0;
    return {
      label,
      declared,
      fullIdentifier,
      exists,
      bound,
      conditional,
      keyCount,
    };
  });

  const relevant = results.filter(
    (r) => r && ("invalid" in r || r.declared.length > 0 || r.exists),
  );
  if (relevant.length === 0) return;

  report.section("local access (read-only service accounts)");
  for (const result of relevant) {
    if (!result) continue;
    if ("invalid" in result) {
      report.fail(`${result.label}: ${result.invalid}`);
      continue;
    }
    const {
      label,
      declared,
      fullIdentifier,
      exists,
      bound,
      conditional,
      keyCount,
    } = result;
    if (declared.length > 0 && getVaultConfig(config).type === "gitlab") {
      report.fail(
        `${label}: localAccess needs a vault that is not a CI variable store (the gitlab vault would expose the key to every CI job)`,
      );
      continue;
    }
    const heal = `run: catladder project setup`;
    if (declared.length === 0) {
      report.warn(
        `${label}: ${fullIdentifier} exists although no local access is declared`,
        heal,
      );
    } else if (!exists) {
      report.fail(`${label}: ${fullIdentifier} does not exist`, heal);
    } else {
      const { missing, extra } = diffRoleBindings(declared, bound);
      if (missing.length > 0) {
        report.fail(
          `${label}: local access account is missing roles: ${missing.join(", ")}`,
          heal,
        );
      }
      if (extra.length > 0) {
        report.fail(
          `${label}: local access account has undeclared roles: ${extra.join(", ")}`,
          heal,
        );
      }
      if (conditional.length > 0) {
        report.fail(
          `${label}: local access account has conditional roles (${conditional.join(", ")}) that setup does not remove`,
          "remove them by hand",
        );
      }
      if (keyCount !== 1) {
        report.fail(
          `${label}: local access account has ${keyCount} user-managed keys, expected exactly 1`,
          heal,
        );
      }
      if (
        missing.length === 0 &&
        extra.length === 0 &&
        conditional.length === 0 &&
        keyCount === 1
      ) {
        report.ok(
          `${label}: local access account has exactly the declared roles`,
        );
      }
    }
  }
};
