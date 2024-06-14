import type { Context } from "@catladder/pipeline";
import { getKubernetesNamespace } from "@catladder/pipeline";
import type { V1ObjectMeta } from "@kubernetes/client-node";
import { V1Namespace } from "@kubernetes/client-node";
import { getk8sApi } from "../../../../../k8sApi";

export default async function (context: Context) {
  const namespace = getKubernetesNamespace(
    context.fullConfig,
    context.environment.shortName,
  );
  const namespaceBody = new V1Namespace();
  const metadata: V1ObjectMeta = {
    name: namespace,
    labels: {
      customerName: context.fullConfig.customerName,
      appName: context.fullConfig.appName,
      environment: context.environment.shortName,
      components: Object.keys(context.fullConfig.components).join("_"), // limited chars available...
      buildTypes: Object.values(context.fullConfig.components)
        .map((config) => config.build.type)
        .join("_"), // limited chars available...
      ...Object.fromEntries(
        Object.entries(context.fullConfig.components).map(
          ([componentName, config]) => [
            "buildType_" + componentName,
            config.build.type,
          ],
        ),
      ),
      ...(context.fullConfig.meta?.labels ?? {}),
    },
  };

  namespaceBody.metadata = metadata;
  const k8sApi = getk8sApi();
  try {
    await k8sApi.readNamespace(namespace);

    await k8sApi.patchNamespace(
      namespace,
      namespaceBody,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { "content-type": "application/merge-patch+json" } }, // see https://github.com/kubernetes-client/javascript/issues/443
    ); // update meta data
  } catch (e) {
    if (e.response?.body?.reason === "NotFound") {
      await k8sApi.createNamespace(namespaceBody);
    } else {
      console.error(e.response?.body);
      throw e;
    }
  }
  return namespace;
}
