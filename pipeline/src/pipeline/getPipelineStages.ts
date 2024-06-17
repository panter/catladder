import { getAllEnvsInAllComponents } from "../config";
import type { Config } from "../types/config";
import { BASE_STAGES } from "../types/jobs";

/**
 * while technically not required, we group different envs in its own stage
 * each job from `createJobs` that is defined as `envMode: "stagePerEnv"` will have `deploy dev`, etc. instead of just `deploy`
 * this is just so that it looks nicer in gitlab and makes running mutliple manual tasks more easy to use
 */
export function getPipelineStages(config: Config) {
  const allEnvs = getAllEnvsInAllComponents(config).filter(
    (e) => e !== "local",
  );
  const stages = BASE_STAGES.reduce<string[]>(
    (acc, baseStage) => [
      ...acc,
      baseStage,
      ...allEnvs.map((e) => `${baseStage} ${e}`),
    ],
    [],
  );
  return stages;
}
