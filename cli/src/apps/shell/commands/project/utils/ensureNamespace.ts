import { V1Namespace, V1ObjectMeta } from "@kubernetes/client-node";
import k8sApi from "../../../../../k8sApi";
import { Env } from "../../../../../types/types";
import { getProjectNamespace } from "../../../../../utils/projects/index";

export default async function (env: Env) {
  const namespace = await getProjectNamespace(env);
  try {
    await k8sApi.readNamespace(namespace);
  } catch (e) {
    if (e.response.body && e.response.body.reason === "NotFound") {
      this.log(`namespace '${namespace} does not exist. `);
      const { shouldContinue } = await this.prompt({
        type: "confirm",
        name: "shouldContinue",
        default: true,
        message: `Should I create namespace '${namespace}'?`,
      });
      if (!shouldContinue) {
        throw new Error("abort");
      }
      const namespaceBody = new V1Namespace();
      const metadata = {
        name: namespace,
      };
      namespaceBody.metadata = metadata as V1ObjectMeta;
      await k8sApi.createNamespace(namespaceBody);
    } else {
      throw e;
    }
  }
}
