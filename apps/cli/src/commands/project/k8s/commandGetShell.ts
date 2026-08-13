import { defineCommand } from "../../../core/defineCommand";
import { getProjectPods } from "../../../kubernetes";

import { getProjectNamespace } from "../../../utils/projects";
import { getShell } from "../../../utils/shell";
import { ensureCluster } from "../../../apps/cli/commands/project/utils/ensureCluster";
import { envAndComponents } from "../../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../../availability";

export const commandGetShell = defineCommand({
  name: "project k8s get-shell",
  description: "get a shell to a pod in the environment",
  group: "project",
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
      choices: async (ctx) => {
        const envComponent = await ctx.get("envComponent");
        const pods = await getProjectPods(envComponent);
        return pods
          .filter((p: any) => p.status.phase == "Running")
          .map((r: any) => r.metadata.name);
      },
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    await ensureCluster(ctx, envComponent);
    const namespace = await getProjectNamespace(envComponent);
    const podName = await ctx.get("podName");
    return getShell(namespace, podName);
  },
});
