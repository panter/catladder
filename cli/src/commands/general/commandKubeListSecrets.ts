import { defineCommand } from "../../core/defineCommand";
import { getk8sApi } from "../../k8sApi";

export const commandKubeListSecrets = defineCommand({
  name: "kube-list-secrets",
  description: "show secrets",
  group: "general",
  inputs: {
    namespace: {
      type: "string",
      message: "kubernetes namespace",
      positional: true,
    },
  },
  execute: async (ctx) => {
    const namespace = await ctx.get("namespace");
    const k8sApi = getk8sApi();
    const res = await k8sApi.listNamespacedSecret(namespace);
    ctx.log(res.body.items.map((n: any) => n.metadata.name).join("\n"));
  },
});
