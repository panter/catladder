import { isOfDeployType } from "@catladder/pipeline";
import { defineCommand } from "../../core/defineCommand";
import {
  getPipelineContextByChoice,
  parseChoice,
} from "../../config/getProjectConfig";
import { openGoogleCloudLogs } from "../../kubernetes/openKubernetesDashboards";
import { openGoogleCloudDashboard } from "../../gcloud/openDashboard";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../availability";

export const commandOpenLogs = defineCommand({
  name: "project logs open",
  description: "open logs for a component (Google Cloud Logging)",
  group: "project",
  isAvailable: hasDeployType("kubernetes", "google-cloudrun"),
  inputs: {
    envComponent: {
      type: "string",
      message: "environment:component",
      positional: true,
      choices: async () => envAndComponents(),
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    const { env, componentName } = parseChoice(envComponent);
    const context = await getPipelineContextByChoice(env, componentName);
    const deployConfig = context.deploy?.config;

    if (isOfDeployType(deployConfig, "kubernetes")) {
      await openGoogleCloudLogs(ctx, context);
    } else if (isOfDeployType(deployConfig, "google-cloudrun")) {
      const serviceName = context.environment.fullName.toLowerCase();
      await openGoogleCloudDashboard(
        ctx,
        `run/detail/${deployConfig.region}/${serviceName}/observability/logs`,
        {
          project: deployConfig.projectId,
        },
      );
    } else {
      ctx.log(`Unsupported deploy type for open-logs: ${deployConfig?.type}`);
    }
  },
});
