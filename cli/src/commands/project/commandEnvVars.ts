import { defineCommand } from "../../core/defineCommand";
import { getEnvVarsResolved, parseChoice } from "../../config/getProjectConfig";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";

export const commandEnvVars = defineCommand({
  name: "project-env-vars",
  description: "list env vars",
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
    // Pass ctx as the logger (IO satisfies LoggerCmdInstance)
    const envvars = await getEnvVarsResolved(ctx as any, env, componentName);
    Object.keys(envvars).forEach((key) => ctx.log(`${key}: ${envvars[key]}`));
  },
});
