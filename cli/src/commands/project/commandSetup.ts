import { defineCommand } from "../../core/defineCommand";
import { setupProject } from "../../apps/cli/commands/project/setup";

export const commandSetup = defineCommand({
  name: "project setup",
  description:
    "Initializes all environments and creates required resources, service accounts, etc.",
  group: "project",
  inputs: {
    component: { type: "string", message: "component name", positional: true },
  },
  execute: async (ctx) => {
    const component = await ctx.get("component");
    await setupProject(ctx, component);
  },
});
