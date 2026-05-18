import { defineCommand } from "../../core/defineCommand";
import { getk8sApi } from "../../k8sApi";

export const commandKubeListNamespaces = defineCommand({
  name: "kube-list-namespaces",
  description: "list all namespaces",
  group: "general",
  inputs: {},
  execute: async (ctx) => {
    const k8sApi = getk8sApi();
    const res = await k8sApi.listNamespace();
    const namespaces = res.body.items.map((n: any) => n.metadata.name);
    ctx.log(namespaces.join("\n"));
  },
});
