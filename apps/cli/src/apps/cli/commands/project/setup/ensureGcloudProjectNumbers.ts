import { getEnvConfig, readCatladderStore } from "@catladder/pipeline";
import {
  getAllComponentsWithAllEnvsFlat,
  getProjectConfig,
  invalidateProjectConfig,
} from "../../../../../config/getProjectConfig";
import type { IO } from "../../../../../core/types";
import { fetchGcloudProjectNumber } from "../../../../../gcloud/getProjectNumber";
import { updateCatladderStore } from "../../../../../store/updateCatladderStore";
import { getGitRoot } from "../../../../../utils/projects";

/**
 * fetches the gcloud project numbers of all cloud run deploys into the
 * catladder store.
 *
 * This must run BEFORE any pipeline context is created: context creation
 * computes the deterministic cloud run urls, which read the project
 * number from the store and throw when it is missing — on a fresh
 * project that would make `project setup` fail with the very error it is
 * supposed to fix (chicken-and-egg).
 */
export const ensureGcloudProjectNumbers = async (instance: IO) => {
  const config = await getProjectConfig();
  if (!config) return;

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

  const root = (await getGitRoot()) ?? process.cwd();
  const store = readCatladderStore(root);
  const missing = [...projectIds].filter(
    (projectId) => !store.gcloudProjects?.[projectId]?.projectNumber,
  );

  for (const projectId of missing) {
    instance.log(`fetch gcloud project number for ${projectId}...`);
    const projectNumber = await fetchGcloudProjectNumber(projectId);
    instance.log(`project number: ${projectNumber}`);
    await updateCatladderStore((current) => ({
      ...current,
      gcloudProjects: {
        ...current.gcloudProjects,
        [projectId]: { projectNumber },
      },
    }));
  }

  if (missing.length > 0) {
    // the store is attached to the config at read time; drop the cached
    // config so contexts created after this pre-pass see the new values
    invalidateProjectConfig();
  }
};
