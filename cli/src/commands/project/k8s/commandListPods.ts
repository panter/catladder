import { stringify } from "yaml";
import { pick } from "lodash";
import { defineCommand } from "../../../core/defineCommand";
import { getProjectPods } from "../../../kubernetes";
import { ensureCluster } from "../../../apps/cli/commands/project/utils/ensureCluster";
import { envAndComponents } from "../../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../../availability";

export const commandListPods = defineCommand({
  name: "project k8s list-pods",
  description: "list pods of local project",
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
    await ensureCluster(ctx, envComponent);
    const pods = await getProjectPods(envComponent);
    ctx.log(
      stringify(
        pods.map((p: any) => pick(p, ["metadata.name", "status.startTime"])),
      ),
    );
  },
});
