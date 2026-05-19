import { stringify } from "yaml";
import { pick } from "lodash";
import { defineCommand } from "../../core/defineCommand";
import { getProjectPods } from "../../kubernetes";
import { ensureCluster } from "../../apps/cli/commands/project/utils/ensureCluster";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";

export const commandListPods = defineCommand({
  name: "project list-pods",
  description: "list pods of local project",
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
    await ensureCluster(ctx, envComponent);
    const pods = await getProjectPods(envComponent);
    ctx.log(
      stringify(
        pods.map((p: any) => pick(p, ["metadata.name", "status.startTime"])),
      ),
    );
  },
});
