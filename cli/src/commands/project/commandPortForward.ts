import { defineCommand } from "../../core/defineCommand";
import { getProjectPodNames } from "../../kubernetes";
import { logError } from "../../utils/log";
import { startKubePortForward } from "../../kubernetes/portForward";
import { getProjectNamespace } from "../../utils/projects";
import { ensureCluster } from "../../apps/cli/commands/project/utils/ensureCluster";
import { parseChoice } from "../../config/parseChoice";
import { getPipelineContextByChoice } from "../../config/getProjectConfig";
import { isOfDeployType } from "@catladder/pipeline";
import { startPortForwardCommand } from "../../utils/portForwards";
import open from "open";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";

export const commandPortForward = defineCommand({
  name: "project port-forward",
  description: "start port-forwarding",
  group: "project",
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
      choices: async (ctx) => getProjectPodNames(await ctx.get("envComponent")),
    },
    localPort: { type: "number", message: "Local port: " },
    remotePort: { type: "number", message: "Remote port: " },
    mr: { type: "number", message: "Which mr 🤔 " },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    const { env, componentName } = parseChoice(envComponent);
    const context = await getPipelineContextByChoice(env, componentName);

    if (isOfDeployType(context.deploy?.config, "kubernetes")) {
      await ensureCluster(ctx, envComponent);
      const namespace = await getProjectNamespace(envComponent);
      const podNames = await getProjectPodNames(envComponent);
      if (podNames.length === 0) {
        logError(ctx, "sorry, no pods found");
        return;
      }
      const podName = await ctx.get("podName");
      const localPort = await ctx.get("localPort");
      const remotePort = await ctx.get("remotePort");
      return startKubePortForward(podName, localPort, remotePort, namespace);
    }

    if (isOfDeployType(context.deploy?.config, "google-cloudrun")) {
      if (!isOfDeployType(context.deploy?.config, "google-cloudrun")) {
        throw new Error("not cloud run");
      }

      const { fullName } = context.environment;
      let serviceName: string = fullName.toString();
      if (context.environment.envType === "review") {
        const mr = await ctx.get("mr");
        serviceName = serviceName
          .toString()
          .replace("-review-", "-review-mr" + mr + "-");
      }

      const { projectId, region } = context.deploy.config;
      const command = `gcloud beta run services proxy ${serviceName} --project ${projectId} --region ${region}`;

      await startPortForwardCommand(`cloudRun/${serviceName}`, command);
      open("http://localhost:8080");
    }
  },
});
