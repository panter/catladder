import {
  getDockerImageVariables,
  requiresDockerBuild,
} from "../../build/docker";
import type { DeployJobDefinition } from "../../types";
import {
  componentContextHasWorkspaceBuild,
  type ComponentContext,
} from "../../types/context";
import type { BaseStage } from "../../types/jobs";
import { CatladderJob } from "../../types/jobs";
import { contextIsStoppable } from "../utils";
import { STOP_JOB_NAME } from "./stop";

import { DEPLOY_RUNNER_VARIABLES } from "./variables";

export const DEPLOY_JOB_NAME = "🚀 Deploy";

export class DeployJob extends CatladderJob {
  constructor(context: ComponentContext, jobDefinition: DeployJobDefinition) {
    const hasDocker = requiresDockerBuild(context);
    const isStoppable = contextIsStoppable(context);

    const autoStop =
      context.environment.envType === "review"
        ? "1 week"
        : context.environment.envType === "dev"
          ? "4 weeks"
          : undefined;

    const deployConfig = context.deploy?.config;

    // if auto or manual is configured explicitly, use that
    const whenDeployDefined =
      deployConfig && deployConfig.when ? deployConfig.when : undefined;
    // otherwise auto deploy if env is not prod. If its prod, deploy automatically if stage is disabled
    const whenDeployDefault =
      context.environment.envType !== "prod"
        ? "auto" // is not stage, auto deploy
        : context.componentConfig.env?.stage === false
          ? "auto" // is prod, but no staging, auto deploy
          : "manual"; // manually deploy
    const whenDeploy = whenDeployDefined
      ? whenDeployDefined
      : whenDeployDefault;

    super({
      name: DEPLOY_JOB_NAME,
      script: jobDefinition.script,
      image: jobDefinition.image,
      caches: jobDefinition.cache,
      artifacts: jobDefinition.artifacts,
      services: jobDefinition.services,
      envMode: "stagePerEnv", // makes it easier to run manual tasks er env

      needs: [
        ...(deployConfig
          ? (deployConfig.waitFor?.map((c) => ({
              componentName: c,
              job: DEPLOY_JOB_NAME,
              artifacts: false,
            })) ?? [])
          : []),
      ],

      needsStages:
        // if the build is disabled, we don't need to wait for it
        context.build.type !== "disabled"
          ? [
              ...(componentContextHasWorkspaceBuild(context)
                ? hasDocker // docker build is per component,
                  ? [
                      // we don't need artifacts, but have to wait for the component build
                      {
                        stage: "build" as BaseStage,
                        artifacts: false,
                      },
                    ]
                  : [
                      {
                        // pick build artifacts from workspace build
                        stage: "build" as BaseStage,
                        artifacts: true,
                        workspaceName: context.build.workspaceName,
                      },
                    ]
                : [
                    {
                      stage: "build" as BaseStage,
                      artifacts: hasDocker ? false : true, // we asume that no-docker deployments need build artifacts,
                    },
                  ]),
              // we don't want to deploy when there is a broken test
              {
                stage: "test",
                artifacts: false,
                // use test from workspace build
                workspaceName: componentContextHasWorkspaceBuild(context)
                  ? context.build.workspaceName
                  : undefined,
              },
            ]
          : [],
      gate: whenDeploy,
      stage: "deploy",
      variables: {
        ...context.environment.envVars,
        ...(hasDocker ? getDockerImageVariables(context) : {}),
        ...context.environment.jobOnlyVars.deploy.envVars,

        ...jobDefinition.variables,
      },
      runnerVariables: {
        ...DEPLOY_RUNNER_VARIABLES,
        ...(jobDefinition.runnerVariables ?? {}),
        ...(deployConfig ? (deployConfig.runnerVariables ?? {}) : {}),
      },
      environment: isStoppable
        ? {
            on_stop: STOP_JOB_NAME,
            auto_stop_in: autoStop,
          }
        : {},
      jobTags: deployConfig ? deployConfig.jobTags : undefined,
    });
  }
}
