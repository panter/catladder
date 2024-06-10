import { writeFileSync } from "fs";
import { stringify } from "yaml";
import { readConfigSync } from "./config";
import { createChildPipeline } from "./pipeline";
import { getPipelineTriggerForGitlabChildPipeline } from "./pipeline/gitlab/getPipelineTriggerForGitlabChildPipeline";

const trigger = getPipelineTriggerForGitlabChildPipeline();

const config = readConfigSync()?.config;
if (!config) {
  throw new Error("no catladder config found");
}
createChildPipeline("gitlab", trigger, config).then(
  ({ jobs, ...mainPipeline }) => {
    // need to spread out the jobs
    writeFileSync(`__pipeline.yml`, stringify({ ...jobs, ...mainPipeline }), {
      encoding: "utf-8",
    });
  }
);
