import { writeFileSync } from "fs";
import { dump } from "js-yaml";
import { readConfigSync } from "./config";
import { PIPELINE_IMAGE_TAG } from "./constants";
import { createChildPipeline } from "./pipeline";
import { PipelineTrigger } from "./types";

const {
  CI_MERGE_REQUEST_ID,
  CI_COMMIT_TAG,
  CI_COMMIT_BRANCH,
  CI_DEFAULT_BRANCH,
} = process.env;

const isDefaultBranch =
  Boolean(CI_DEFAULT_BRANCH) && CI_COMMIT_BRANCH === CI_DEFAULT_BRANCH;
const isHotfixBranch = false; // TODO:  $CI_COMMIT_BRANCH =~ /^[0-9]+\.([0-9]+|x)\.x$/
const isMergeRequest = Boolean(CI_MERGE_REQUEST_ID);
const isTaggedRelease = Boolean(CI_COMMIT_TAG);

console.info(`catladder version ${PIPELINE_IMAGE_TAG}`);

const trigger: PipelineTrigger | null =
  isMergeRequest || isHotfixBranch
    ? "mr"
    : isDefaultBranch
    ? "mainBranch"
    : isTaggedRelease
    ? "taggedRelease"
    : null;
if (trigger) {
  const config = readConfigSync();
  if (!config) {
    throw new Error("no catladder config found");
  }
  createChildPipeline(trigger, config).then((mainPipeline) => {
    writeFileSync(`__pipeline.yml`, dump(mainPipeline), {
      encoding: "utf-8",
    });
  });
} else {
  throw new Error(
    "no matching trigger: " +
      JSON.stringify(
        {
          isMergeRequest,
          isDefaultBranch,
          isTaggedRelease,
        },
        null,
        2
      )
  );
}
