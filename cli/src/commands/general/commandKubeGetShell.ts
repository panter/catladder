import { defineCommand } from "../../core/defineCommand";
import { getk8sApi } from "../../k8sApi";

import { getShell } from "../../utils/shell";

export const commandKubeGetShell = defineCommand({
  name: "kube-get-shell",
  description: "get a shell to a pod in the environment",
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
  },
  execute: async (ctx) => {
    const namespace = await ctx.get("namespace");
    const podName = await ctx.get("podName");
    await getShell(namespace, podName);
  },
});
