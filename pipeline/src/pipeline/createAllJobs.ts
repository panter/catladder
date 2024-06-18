import type { CreateAllComponentsContextProps } from "../context/createAllComponentsContext";
import { createAllComponentsContext } from "../context/createAllComponentsContext";
import { createWorkspaceContext } from "../context/createWorkspaceContext";
import type { ComponentContext, WorkspaceContext } from "../types";
import { componentContextHasWorkspaceBuild } from "../types";
import type { CatladderJob } from "../types/jobs";
import { createJobsForComponentContext } from "./createJobsForComponent";
import { createJobsForWorkspace } from "./createJobsForWorkspace";

export type AllCatladderJobs = {
  workspaces: Array<{
    context: WorkspaceContext;
    jobs: Array<CatladderJob>;
  }>;
  components: Array<{
    context: ComponentContext;
    jobs: Array<CatladderJob>;
  }>;
};

export const createAllJobs = async ({
  config,
  trigger,
  pipelineType,
}: CreateAllComponentsContextProps): Promise<AllCatladderJobs> => {
  const allComponentsContext = await createAllComponentsContext({
    config,
    trigger,
    pipelineType,
  });

  return {
    workspaces: await Promise.all(
      Object.keys(config.builds ?? {}).map(async (workspaceName) => {
        const componentsInAllEnvs = allComponentsContext.filter(
          (context) =>
            componentContextHasWorkspaceBuild(context) &&
            context.build.workspaceName === workspaceName,
        );

        const allEnvs = [...new Set(componentsInAllEnvs.map(({ env }) => env))];

        return await Promise.all(
          allEnvs.map(async (env) => {
            const workspaceContext = await createWorkspaceContext({
              components: componentsInAllEnvs.filter(
                ({ env: componentEnv }) => componentEnv === env,
              ),
              workspaceName,
              config,
              trigger,
              pipelineType,
              env,
            });

            return {
              context: workspaceContext,
              jobs: createJobsForWorkspace(workspaceContext),
            };
          }),
        );
      }),
    ).then((f) => f.flat()),

    components: allComponentsContext.map((context) => {
      return {
        context,
        jobs: createJobsForComponentContext(context),
      };
    }),
  };
};
