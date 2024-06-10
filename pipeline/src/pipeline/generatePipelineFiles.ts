import type { Config, PipelineMode, PipelineType } from "../types";
import { writeYamlfile } from "../utils/writeFiles";
import { createChildPipeline } from "./createChildPipeline";
import { createMainPipeline } from "./createMainPipeline";
import { getPipelineTriggerForGitlabChildPipeline } from "./gitlab/getPipelineTriggerForGitlabChildPipeline";
export async function generatePipelineFiles<T extends PipelineType>(
  config: Config,
  pipelineType: T,
  mode: PipelineMode<T>
) {
  if (mode === "childpipeline") {
    const trigger = getPipelineTriggerForGitlabChildPipeline();

    const { jobs, ...mainPipeline } = await createChildPipeline(
      pipelineType,
      trigger,
      config
    );
    // need to spread out the jobs, forgot why
    await writeYamlfile(`__pipeline.yml`, { ...jobs, ...mainPipeline });
  } else {
    const { jobs, ...mainPipeline } = await createMainPipeline(
      pipelineType,
      config
    );
    // need to spread out the jobs, forgot why
    await writeYamlfile(`.gitlab-ci.yml`, { ...jobs, ...mainPipeline });
  }
}
