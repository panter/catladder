import type { ComponentContext } from "@catladder/pipeline";
import { getEnabledPipelineTypes } from "@catladder/pipeline";
import {
  getAllPipelineContexts,
  getProjectConfig,
} from "../../../../../config/getProjectConfig";
import type { IO } from "../../../../../core/types";
import { checkCloudRun } from "./checkCloudRun";
import { checkGithub } from "./checkGithub";
import { checkGitlab } from "./checkGitlab";
import { checkStore } from "./checkStore";
import { DoctorReport } from "./DoctorReport";

/**
 * read-only health check: compares the state `project setup` (and
 * `project secrets-sync-github`) would provision for the CURRENT config
 * against what is actually there, and reports drift together with the
 * command that heals it. `project setup` is a point-in-time
 * provisioner, so config edits that change required infrastructure
 * (IAM roles, services, secrets) drift silently until something breaks
 * in ci — the doctor surfaces that before it does.
 *
 * The component filter only narrows the per-component checks; the
 * cheap project-global checks (store, gitlab, github) always run.
 */
export const doctorProject = async (
  instance: IO,
  onlyComponents?: string | string[],
) => {
  const config = await getProjectConfig();
  if (!config) {
    throw new Error("no catladder config found");
  }
  instance.log(
    "🐱 🩺 checking project health — read-only, nothing will be changed",
  );

  const report = new DoctorReport(instance);
  await checkStore(report);

  let contexts: ComponentContext[] = [];
  try {
    contexts = await getAllPipelineContexts(onlyComponents);
  } catch (e) {
    report.section("pipeline contexts");
    report.fail(
      `could not create pipeline contexts: ${e.message}`,
      "run: catladder project setup",
    );
  }

  if (getEnabledPipelineTypes(config).includes("gitlab")) {
    await checkGitlab(instance, report, contexts);
  }
  await checkCloudRun(report, contexts);
  await checkGithub(report, config);

  report.summarize();
};
