import { cloneDeep } from "lodash-es";
import type {
  BuildContextStandalone,
  ComponentContext,
  WorkspaceContext,
} from "../..";
import { getRunnerImage } from "../..";
import type { AppBuildJobDefinition } from "../../types/jobDefinition";
import type { Artifacts } from "../../types/gitlab-types";
import { CatladderJob } from "../../types/jobs";
import { ensureArray } from "../../utils";
import { removeUndefined } from "../../utils/removeUndefined";
import { createBuildJobArtifacts } from "../artifacts/createBuildJobArtifact";
import { ensureNodeVersion } from "../node/packageManagerInstall";
import {
  APP_BUILD_JOB_NAME,
  RUNNER_BUILD_RESOURCE_VARIABLES,
} from "./constants";
import { writeBuildInfo } from "./writeBuildInfo";
import {
  componentContextNeedsBuildTimeDotEnv,
  writeDotEnv,
} from "./writeDotEnv";

export class AppBuildJob extends CatladderJob {
  private constructor(
    context: ComponentContext<BuildContextStandalone> | WorkspaceContext,
    {
      script,
      variables,
      runnerVariables,
      cache,
      ...def
    }: AppBuildJobDefinition,
    artifacts: Artifacts | undefined,
  ) {
    super({
      name: APP_BUILD_JOB_NAME,
      envMode: "jobPerEnv",
      stage: "build",
      provides: ["buildArtifacts"],
      image: getRunnerImage("jobs-default"),
      needs: [],
      caches: cache,
      variables: {
        ...(variables ?? {}),
        ...(context.type === "component"
          ? {
              ...context.environment.envVars,
              ...context.environment.jobOnlyVars.build.envVars,
            }
          : {}),
      },
      runnerVariables: {
        ...RUNNER_BUILD_RESOURCE_VARIABLES,
        ...(runnerVariables ?? {}),
        ...(context.build.config.runnerVariables ?? {}),
      },

      script: [
        ...(context.type === "component"
          ? componentContextNeedsBuildTimeDotEnv(context)
            ? writeDotEnv(context)
            : []
          : context.type === "workspace"
            ? context.components
                .filter((c) => componentContextNeedsBuildTimeDotEnv(c))
                .flatMap((c) => writeDotEnv(c))
            : []),
        ...(context.type === "component" ? writeBuildInfo(context) : []),
        ...ensureNodeVersion(context), // in pure node repos, we might want to have the nvmrc file in top-level
        `cd ${context.build.dir}`,
        ...ensureArray(script),
      ],
      artifacts,
      // definition overrides the defaults above; undefined values are
      // skipped and objects cloned to keep the previous lodash `merge`
      // semantics (cloning avoids shared references, which would show up
      // as anchors/aliases in the generated yaml)
      ...cloneDeep(removeUndefined(def)),
    });
  }

  static async create(
    context: ComponentContext<BuildContextStandalone> | WorkspaceContext,
    definition: AppBuildJobDefinition,
  ): Promise<AppBuildJob> {
    return new AppBuildJob(
      context,
      definition,
      await createBuildJobArtifacts(context),
    );
  }
}
