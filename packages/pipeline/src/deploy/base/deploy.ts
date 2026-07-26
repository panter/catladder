import {
  getDockerImageVariables,
  requiresDockerBuild,
} from "../../build/docker";
import type { DeployJobDefinition } from "../../types";
import {
  componentContextHasWorkspaceBuild,
  type ComponentContext,
} from "../../types/context";
import type { Requirement } from "../../types/jobs";
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

    // wait for the deployment of other components first
    const waitForRequirements: Requirement[] =
      deployConfig?.waitFor?.map((c) => ({
        capability: "deployment",
        from: { component: c },
        artifacts: false,
        strict: true, // a component we wait for must have a deployment
      })) ?? [];

    const buildRequirements: Requirement[] = componentContextHasWorkspaceBuild(
      context,
    )
      ? hasDocker // docker build is per component,
        ? [
            {
              // the deployment needs the docker image, which must exist
              capability: "dockerImage",
              artifacts: false,
              strict: true,
            },
          ]
        : [
            {
              // pick build artifacts from workspace build
              capability: "buildArtifacts",
              artifacts: true,
              from: { workspace: context.build.workspaceName },
            },
          ]
      : [
          {
            // wait for all build jobs of the component
            capability: "build",
            artifacts: hasDocker ? false : true, // we asume that no-docker deployments need build artifacts,
          },
          ...(hasDocker
            ? [
                {
                  // the deployment needs the docker image, which must exist
                  capability: "dockerImage" as const,
                  artifacts: false,
                  strict: true,
                },
              ]
            : []),
        ];

    // we don't want to deploy when there is a broken test
    const qualityGateRequirement: Requirement = {
      capability: "qualityGate",
      artifacts: false,
      // use test from workspace build
      from: componentContextHasWorkspaceBuild(context)
        ? { workspace: context.build.workspaceName }
        : undefined,
    };

    super({
      name: DEPLOY_JOB_NAME,
      script: jobDefinition.script,
      image: jobDefinition.image,
      caches: jobDefinition.cache,
      artifacts: jobDefinition.artifacts,
      services: jobDefinition.services,
      pages: jobDefinition.pages,
      allow_failure: jobDefinition.allow_failure ?? deployConfig?.allowFailure,
      envMode: "stagePerEnv", // makes it easier to run manual tasks er env

      needs: [],

      requires: [
        ...waitForRequirements,
        // if the build is disabled, we don't need to wait for it
        ...(context.build.type !== "disabled"
          ? [...buildRequirements, qualityGateRequirement]
          : []),
      ],
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
            onStop: STOP_JOB_NAME,
            autoStopIn: autoStop,
          }
        : {},
      jobTags: deployConfig ? deployConfig.jobTags : undefined,
    });
  }
}
