import { mkdir, rm } from "fs/promises";
import { dirname } from "path";
import type { Config, GitlabJobDef, PipelineType } from "../types";
import { writeYamlfile } from "../utils/writeFiles";
import { createMainPipeline } from "./createMainPipeline";
import { sortGitLabJobDefProps } from "./gitlab/sortGitLabJobDefProps";

const CATLADDER_GENERATED_FOLDER = ".catladder-generated";

const GITLAB_GENERATED_FOLDER = CATLADDER_GENERATED_FOLDER + "/gitlab";

type YamlFile = {
  path: string;
  content: Record<string, unknown>;
};
export async function generatePipelineFiles<T extends PipelineType>(
  config: Config,
  pipelineType: T,
) {
  if (pipelineType !== "gitlab") {
    throw new Error("Pipeline type not supported");
  }
  const includes = await getGitlabPipelineIncludes(config);

  const mainFile: YamlFile = {
    path: ".gitlab-ci.yml",
    content: {
      include: includes.map((i) => i.path),
    },
  };

  const files = [mainFile, ...includes];

  // first clean up the folder
  await rm(GITLAB_GENERATED_FOLDER, { force: true, recursive: true });
  // write files
  await Promise.all(
    files.map(async ({ path, content }) => {
      await mkdir(dirname(path), { recursive: true });
      await writeYamlfile(path, content);
    }),
  );
}
async function getGitlabPipelineIncludes(config: Config) {
  const { jobs, image, stages, variables, workflow, ...pipelineRest } =
    await createMainPipeline("gitlab", config);
  // we will create 1 include per component or workspace
  // this is for better readability in git diffs and to avoid problems with yaml files beeing too large
  // group by context
  const groups = Object.entries(jobs).reduce(
    (acc, [jobName, { gitlabJob, context }]) => {
      const group = !context
        ? "global-jobs"
        : context?.type + "/" + context.name;
      if (!acc[group]) {
        acc[group] = {};
      }

      acc[group][jobName] = sortGitLabJobDefProps(gitlabJob); // also sort properties for more consistent diffing
      return acc;
    },
    {} as Record<string, Record<string, GitlabJobDef>>,
  );

  const componentIncludes = Object.entries(groups).map(([group, jobs]) => {
    return {
      path: GITLAB_GENERATED_FOLDER + "/" + group + ".yaml",
      content: jobs,
    };
  });

  const mainInclude: YamlFile = {
    path: GITLAB_GENERATED_FOLDER + "/main.yaml",
    content: {
      image,
      stages,
      variables,
      workflow,
      ...pipelineRest,
    },
  };

  const includes = [mainInclude, ...componentIncludes];
  return includes;
}

/**
 *
 * for testing purposes
 */
export async function getGitlabCompletePipeline(config: Config) {
  const includes = await getGitlabPipelineIncludes(config);

  return includes.reduce((acc, { content }) => {
    return {
      ...acc,
      ...content, // merge all includes into one object
    };
  }, {});
}
