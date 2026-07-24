import open from "open";
import { defineCommand } from "../../core/defineCommand";
import { getEnvironment, parseChoice } from "../../config/getProjectConfig";
import { ensureCluster } from "../../apps/cli/commands/project/utils/ensureCluster";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";

export const commandOpenEnv = defineCommand({
  name: "project open env",
  description: "open the live environment",
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
    await ensureCluster(ctx, envComponent);
    const environment = await getEnvironment(env, componentName);
    const url = environment.envVars.ROOT_URL;
    open(url.toString());
  },
});
