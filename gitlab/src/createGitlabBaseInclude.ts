/**
 *
 */
import { GitlabJobDef } from "@catladder/pipeline";
import { getNodeCache } from "@catladder/pipeline/dist/build/node";
const PIPELINE_IMAGE_TAG = "foo";

export const createGitlabBaseInclude = () => {
  const jobs: {
    [name: string]: GitlabJobDef;
  } = {
    "create-pipeline": {
      interruptible: true,
      stage: "setup",
      cache: getNodeCache(),
      script: [
        "yarn --frozen-lockfile", // in case that it has a package.json (needed when using ts file for catladder),
        "gitlabWriteChildPipeline",
      ],
    },
  };
  return {
    image:
      "git.panter.ch:5001/catladder/gitlab-ci/pipeline:" + PIPELINE_IMAGE_TAG,
    stages: ["setup", "deploy", "verify", "actions"],
    ...jobs,
  };
};
