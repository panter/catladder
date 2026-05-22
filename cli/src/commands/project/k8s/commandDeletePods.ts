import { defineCommand } from "../../../core/defineCommand";
import { getk8sApi } from "../../../k8sApi";
import { getProjectPodNames } from "../../../kubernetes";
import { logError } from "../../../utils/log";
import { getProjectNamespace } from "../../../utils/projects";
import { ensureCluster } from "../../../apps/cli/commands/project/utils/ensureCluster";
import { envAndComponents } from "../../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../../availability";

export const commandDeletePods = defineCommand({
  name: "project k8s delete-pods",
  description: "delete / restart pods",
  group: "project",
  isAvailable: hasDeployType("kubernetes"),

  inputs: {
    envComponent: {
      type: "string",
      message: "environment:component",
      positional: true,
      choices: async () => envAndComponents(),
    },
    selectedPodNames: {
      type: "string[]",
      message: "Which pods to delete / restart ? 🤔  ",
      choices: async (ctx) => getProjectPodNames(await ctx.get("envComponent")),
    },
  },

  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    await ensureCluster(ctx, envComponent);
    const namespace = await getProjectNamespace(envComponent);

    const selectedPodNames = await ctx.get("selectedPodNames");

    ctx.log(
      "the following pods will be DELETED 🙀 (and therefore restarted 😸)",
    );
    ctx.log("");
    selectedPodNames.forEach((n: string) => ctx.log(n));
    ctx.log("");

    const shouldContinue = await ctx.confirm("Continue ? 🤔  ");

    ctx.log("");
    const k8sApi = getk8sApi();
    if (shouldContinue) {
      for (const podName of selectedPodNames) {
        await k8sApi.deleteNamespacedPod(podName, namespace, "true");
        ctx.log(`deleted pod '${podName}'`);
      }
    }
  },
});
