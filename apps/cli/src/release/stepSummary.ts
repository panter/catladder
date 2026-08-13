/**
 * github step summaries: markdown shown on the run page, so a run
 * explains what happened without reading job logs. No-op outside
 * github actions (GITHUB_STEP_SUMMARY unset, e.g. on gitlab).
 */
import { appendFileSync } from "fs";

export const appendStepSummary = (markdown: string) => {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) {
    return;
  }
  appendFileSync(file, markdown + "\n");
};

/**
 * link to a generated workflow's run list (e.g.
 * `workflowLink("catladder-main.yml", "catladder main")`)
 */
export const workflowLink = (fileName: string, label: string): string => {
  const server = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return label;
  }
  return `[${label}](${server}/${repository}/actions/workflows/${fileName})`;
};
