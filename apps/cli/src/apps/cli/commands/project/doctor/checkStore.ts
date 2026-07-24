import { getEnvConfig, readCatladderStore } from "@catladder/pipeline";
import {
  getAllComponentsWithAllEnvsFlat,
  getProjectConfig,
} from "../../../../../config/getProjectConfig";
import { getGitRoot } from "../../../../../utils/projects";
import type { DoctorReport } from "./DoctorReport";

/**
 * every google-cloudrun project in the config needs its project number
 * in the committed store — the deterministic cloud run urls
 * (<service>-<projectNumber>.<region>.run.app) are computed from it at
 * generation time. This check is fully offline.
 */
export const checkStore = async (report: DoctorReport) => {
  const config = await getProjectConfig();
  const projectIds = new Set<string>();
  for (const {
    componentName,
    env,
  } of await getAllComponentsWithAllEnvsFlat()) {
    const { deploy } = getEnvConfig(config, componentName, env);
    if (deploy && deploy.type === "google-cloudrun") {
      projectIds.add(deploy.projectId);
    }
  }
  if (projectIds.size === 0) return;

  report.section("catladder store (.catladder-store/store.yml)");
  const root = (await getGitRoot()) ?? process.cwd();
  const store = readCatladderStore(root);
  for (const projectId of projectIds) {
    const projectNumber = store.gcloudProjects?.[projectId]?.projectNumber;
    if (projectNumber) {
      report.ok(`project number for ${projectId}: ${projectNumber}`);
    } else {
      report.fail(
        `missing project number for ${projectId}`,
        "run: catladder project setup",
      );
    }
  }
};
