import { defineCommand } from "../../core/defineCommand";
import { getProjectNamespace } from "../../utils/projects";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";

export const commandNamespace = defineCommand({
  name: "project namespace",
  description: "show namespace of local project",
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
    ctx.log(await getProjectNamespace(envComponent));
  },
});
