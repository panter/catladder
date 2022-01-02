import { existsSync, writeFileSync } from "fs";
import { parse } from "yaml";
import { createChildPipeline } from ".";
import { PIPELINE_IMAGE_TAG } from "./constants";
import { PipelineTrigger } from "./types";

const {
  CI_MERGE_REQUEST_ID,
  CI_COMMIT_TAG,
  CI_COMMIT_BRANCH,
  CI_DEFAULT_BRANCH,
} = process.env;

const isDefaultBranch = CI_COMMIT_BRANCH == CI_DEFAULT_BRANCH;
const isHotfixBranch = false; // TODO:  $CI_COMMIT_BRANCH =~ /^[0-9]+\.([0-9]+|x)\.x$/
const isMergeRequest = Boolean(CI_MERGE_REQUEST_ID);
const isTaggedRelease = Boolean(CI_COMMIT_TAG);

const fullPath = (ext: string) => process.cwd() + "/catladder." + ext;
const readConfig = () => {
  const found = ["ts", "js", "yml", "yaml"].find((extension) =>
    existsSync(fullPath(extension))
  );
  if (found) {
    if (found === "ts" || found === "js") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(fullPath(found)).default;
    } else {
      return parse(fullPath(found));
    }
  }
};

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
  const config = readConfig();
  createChildPipeline(trigger, config).then((mainPipeline) => {
    writeFileSync(`__pipeline.yml`, JSON.stringify(mainPipeline, null, 2), {
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
