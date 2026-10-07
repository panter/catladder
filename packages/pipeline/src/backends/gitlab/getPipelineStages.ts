import { getAllEnvsInAllComponents } from "../../config";
import type { Config } from "../../types/config";
import type { BaseStage } from "../../types/jobs";
import { BASE_STAGES } from "../../types/jobs";

/**
 * stages that only appear in the pipeline when a job uses them, so that
 * projects not using the feature keep their generated files unchanged
 */
const OPTIONAL_STAGES: BaseStage[] = ["post-build"];

/**
 * while technically not required, we group different envs in its own stage
 * each job from `createJobs` that is defined as `envMode: "stagePerEnv"` will have `deploy dev`, etc. instead of just `deploy`
 * this is just so that it looks nicer in gitlab and makes running mutliple manual tasks more easy to use
 *
 * `usedStages` are the stages of all generated jobs; optional stages are
 * dropped when none of them is used.
 */
export function getPipelineStages(
  config: Config,
  usedStages: Set<string> = new Set(),
) {
  const allEnvs = getAllEnvsInAllComponents(config).filter(
    (e) => e !== "local",
  );
  const isUsed = (baseStage: BaseStage) =>
    [...usedStages].some(
      (stage) => stage === baseStage || stage.startsWith(`${baseStage} `),
    );
  const stages = BASE_STAGES.filter(
    (baseStage) => !OPTIONAL_STAGES.includes(baseStage) || isUsed(baseStage),
  ).reduce<string[]>(
    (acc, baseStage) => [
      ...acc,
      baseStage,
      ...allEnvs.map((e) => `${baseStage} ${e}`),
    ],
    [],
  );
  return stages;
}
