import { defineCommand } from "../../core/defineCommand";

import { getProjectNamespace } from "../../utils/projects";
import { ensureCluster } from "../../apps/cli/commands/project/utils/ensureCluster";
import {
  getMongodbShell,
  getProjectMongodbAllPodsSortedWithLabel,
} from "../../apps/cli/commands/mongodb/utils";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../availability";

export const commandMongoGetShell = defineCommand({
  name: "project mongo get-shell",
  description: "get a shell to a mongodb in the environment",
  group: "mongodb",
  isAvailable: hasDeployType("kubernetes"),
  inputs: {
    envComponent: {
      type: "string",
      message: "environment:component",
      positional: true,
      choices: async () => envAndComponents(),
    },
    podName: {
      type: "string",
      message: "Which pod? 🤔",
      choices: async (ctx) =>
        getProjectMongodbAllPodsSortedWithLabel(await ctx.get("envComponent")),
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    await ensureCluster(ctx, envComponent);
    const namespace = await getProjectNamespace(envComponent);
    const podName = await ctx.get("podName");
    return getMongodbShell(namespace, podName);
  },
});
