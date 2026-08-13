import { doctorProject } from "../../apps/cli/commands/project/doctor";
import { defineCommand } from "../../core/defineCommand";

export const commandDoctor = defineCommand({
  name: "project doctor",
  description:
    "Checks for drift between the config and the provisioned infrastructure (read-only): service accounts, IAM roles, gitlab tokens, github secrets, store entries.",
  group: "project",
  inputs: {
    component: {
      type: "string",
      message: "component name",
      positional: true,
      required: false,
    },
  },
  execute: async (ctx) => {
    const component = await ctx.get("component");
    await doctorProject(ctx, component);
  },
});
