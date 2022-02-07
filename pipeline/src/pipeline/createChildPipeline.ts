import { getAllEnvsByTrigger, getAllEnvsInAllComponents } from "../config";
import { createJobs } from "./createJobs";
import { RULES_ALWAYS } from "../rules";
import { getRunnerImage } from "../runner";
import { Config, PipelineTrigger } from "../types/config";
import { GitlabJobDef } from "../types/gitlab-types";
const baseStages = ["setup", "test", "build", "deploy", "verify", "stop"];
export const createChildPipeline = async (
  trigger: PipelineTrigger,
  config: Config
) => {
  const components = Object.keys(config.components);

  // 2. write the triggering pipeline

  const jobs = await components.reduce<Promise<Record<string, GitlabJobDef>>>(
    async (acc, componentName) => {
      const envs = getAllEnvsByTrigger(config, componentName, trigger);
      return {
        ...(await acc),
        ...(await createJobs(envs, config, componentName, trigger)),
      };
    },
    Promise.resolve({})
  );

  // while technically not required, we group different envs in its own stage
  // each job from `createJobs` that is defined as `envMode: "stagePerEnv"` will have `deploy dev`, etc. instead of just `deploy`
  // this is just so that it looks nicer in gitlab and makes running mutliple manual tasks more easy to use

  const allEnvs = getAllEnvsInAllComponents(config);
  const stages = baseStages.reduce<string[]>(
    (acc, baseStage) => [
      ...acc,
      baseStage,
      ...allEnvs.map((e) => `${baseStage} ${e}`),
    ],
    []
  );

  const childPipeline = {
    image: getRunnerImage("jobs"), // default image
    variables: {
      FF_USE_FASTZIP: "true",
    },
    workflow: {
      rules: RULES_ALWAYS,
    },
    stages,
    ...jobs,
  };

  return childPipeline as typeof childPipeline & Record<string, GitlabJobDef>;
};
