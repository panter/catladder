import { V1Namespace, V1ObjectMeta } from "@kubernetes/client-node";
import k8sApi from "../../../../../k8sApi";

export default async function (namespace: string) {
  try {
    await k8sApi.readNamespace(namespace);
  } catch (e) {
    if (e.response?.body?.reason === "NotFound") {
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
