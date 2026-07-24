import { defineCommand } from "../../core/defineCommand";
import { getk8sApi } from "../../k8sApi";
import { startKubePortForward } from "../../kubernetes/portForward";

export const commandKubePortForward = defineCommand({
  name: "k8s port-forward",
  description: "start port-forwarding",
  group: "general",
  inputs: {
    namespace: {
      type: "string",
      message: "kubernetes namespace",
      positional: true,
    },
    podName: {
      type: "string",
      message: "Which pod? 🤔",
      choices: async (ctx) => {
        const namespace = await ctx.get("namespace");
        const k8sApi = getk8sApi();
        const res = await k8sApi.listNamespacedPod(namespace);
        return res.body.items.map((i: any) => i.metadata.name);
      },
    },
    localPort: { type: "number", message: "Local port: " },
    remotePort: { type: "number", message: "Remote port: " },
  },
  execute: async (ctx) => {
    const namespace = await ctx.get("namespace");
    const podName = await ctx.get("podName");
    const localPort = await ctx.get("localPort");
    const remotePort = await ctx.get("remotePort");
    return startKubePortForward(podName, localPort, remotePort, namespace);
  },
});
