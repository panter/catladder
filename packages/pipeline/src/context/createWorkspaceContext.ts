import {
  WORKSPACE_BUILD_TYPES,
  type Config,
  type PipelineTrigger,
  type PipelineType,
  type WorkspaceContext,
} from "..";
import { getPackageManagerInfoBase } from "../pipeline/packageManager";
import { mergeWithMergingArrays } from "../utils";
import { uniq } from "lodash-es";

export async function createWorkspaceContext({
  env,
  components,
  workspaceName,
  config,
  pipelineType,
  trigger,
}: {
  env: string;
  components: WorkspaceContext["components"];
  workspaceName: string;
  config: Config;
  pipelineType: PipelineType;
  trigger: PipelineTrigger;
}): Promise<WorkspaceContext> {
  const workspaceConfigRaw = config.builds?.[workspaceName];
  if (!workspaceConfigRaw) {
    throw new Error(`Workspace ${workspaceName} not found in config`);
  }

  const packageManagerInfo = getPackageManagerInfoBase(config);
  const defaults = WORKSPACE_BUILD_TYPES[workspaceConfigRaw.type].defaults(
    (await packageManagerInfo).type,
  );

  const workspaceConfig = mergeWithMergingArrays(defaults, workspaceConfigRaw);
  return {
    name: workspaceName,
    pipelineType,
    trigger,
    type: "workspace",

    workspaceConfig,

    env,
    components,
    fullConfig: config,
    packageManagerInfo,
    build: {
      type: "workspace",
      dir: workspaceConfig.dir ?? ".",
      getComponentDirs: async (mode) =>
        uniq(
          (
            await Promise.all(
              components.map((c) => c.build.getComponentDirs(mode)),
            )
          ).flat(),
        ),
      buildType: workspaceConfig.type,
      config: workspaceConfig,
    },
  };
}
