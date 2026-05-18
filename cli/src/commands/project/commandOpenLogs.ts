import { defineCommand } from "../../core/defineCommand";
import {
  getPipelineContextByChoice,
  parseChoice,
} from "../../config/getProjectConfig";
import { openGoogleCloudLogs } from "../../kubernetes/openKubernetesDashboards";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";

export const commandOpenLogs = defineCommand({
  name: "project-open-logs",
  description: "open google cloud logs (stackdriver logs)",
  group: "project",
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
    await openGoogleCloudLogs(ctx, context);
  },
});
