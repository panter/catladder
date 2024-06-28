/**
 *
 */
import type { GitlabJobDef } from "@catladder/pipeline";
import {
  RULES_ALWAYS,
  getRunnerImage,
  getGitlabReleaseJobs,
} from "@catladder/pipeline";

type GitlabJobDefWithTrigger = Omit<GitlabJobDef, "script"> & {
  trigger: {
    strategy: "depend";
    include: Array<{
      artifact: string;
      job: string;
    }>;
  };
};
export const createGitlabBaseInclude = () => {
  const jobs: {
    [name: string]: GitlabJobDef | GitlabJobDefWithTrigger;
  } = {
    "create-pipeline": {
      interruptible: true,
      rules: RULES_ALWAYS,
      stage: "setup",
      //cache: getNodeCache(),
      script: [
        // in case someone uses ts files and imports Config from catladder, we have to provide the package
        // installing it normally would also install other npm packages, which we want to avoid in this job here to speed it up
        // so we cheat and just copy the folder into node_modules
        "mkdir -p node_modules/@catladder",
        "cp -r /packages/pipeline/ node_modules/@catladder/pipeline",
        "catladder-gitlab childpipeline", // global command
      ],
      artifacts: {
        paths: ["__pipeline.yml"],
      },
      // small footprint for this job
      variables: {
        KUBERNETES_CPU_REQUEST: "0.45",
        KUBERNETES_MEMORY_REQUEST: "200Mi",
        KUBERNETES_MEMORY_LIMIT: "400Mi",
      },
    },
    deploy: {
      stage: "deploy",
      needs: ["create-pipeline"],
      rules: RULES_ALWAYS,
      trigger: {
        strategy: "depend",
        include: [
          {
            artifact: "__pipeline.yml",
            job: "create-pipeline",
          },
        ],
      },
    },
    ...getGitlabReleaseJobs(),
  };
  return {
    image: getRunnerImage("base-pipeline"),
    stages: ["setup", "deploy", "verify", "release"],
    variables: {
      GIT_DEPTH: "1", // no need to clone full history
    },
    ...jobs,
  };
};
