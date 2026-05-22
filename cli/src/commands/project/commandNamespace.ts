import { defineCommand } from "../../core/defineCommand";
import { getProjectNamespace } from "../../utils/projects";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../availability";

export const commandNamespace = defineCommand({
  name: "project namespace",
  description: "show namespace of local project",
  group: "project",
  isAvailable: hasDeployType("kubernetes"),
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
    ctx.log(await getProjectNamespace(envComponent));
  },
});
