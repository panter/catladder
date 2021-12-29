/**
 *
 */
import { GitlabJobDef } from "@catladder/pipeline";
import { getNodeCache } from "@catladder/pipeline/dist/build/node";

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
      "git.panter.ch:5001/catladder/gitlab-ci/pipeline:" +
      process.env.CI_COMMIT_SHA,
    stages: ["setup", "deploy", "verify", "actions"],
    ...jobs,
  };
};
