import { exec } from "child-process-promise";
import { defineCommand } from "../../core/defineCommand";
import { getProjectPvcs } from "../../kubernetes";
import { logError } from "../../utils/log";
import { getProjectNamespace } from "../../utils/projects";
import { ensureCluster } from "../../apps/cli/commands/project/utils/ensureCluster";
import { getMongoDbPodsWithReplInfo } from "../../apps/cli/commands/mongodb/utils";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../availability";

const removeFinalizer = async (
  namespace: string,
  type: "pod" | "pv" | "pvc",
  name: string,
) =>
  exec(
    `kubectl patch --namespace ${namespace} ${type} ${name} -p '{"metadata":{"finalizers":null}}'`,
  );

const deleteResource = async (
  namespace: string,
  type: "pod" | "pv" | "pvc",
  name: string,
) => exec(`kubectl delete --namespace ${namespace} ${type} ${name}`);

const removeFinalizerAndDelete = async (
  namespace: string,
  type: "pod" | "pv" | "pvc",
  name: string,
) => {
  return Promise.all([
    removeFinalizer(namespace, type, name),
    await deleteResource(namespace, type, name),
  ]);
};

export const commandMongoDestroyMember = defineCommand({
  name: "project mongo destroy-member",
  description: "DESTROY a member of a replicaset in order to reinitialize it",
  group: "mongodb",
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
        const mongodbPods = await getMongoDbPodsWithReplInfo(envComponent);
        const secondaries = mongodbPods.filter((pod: any) => !pod.isMaster);
        return secondaries.map((p: any) => ({
          name: `[ secondary ] ${p.podName}`,
          value: p.podName,
        }));
      },
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    await ensureCluster(ctx, envComponent);
    ctx.log(
      "this command tries to delete a (secondary) member of the replicaset, it's persistent volume claim (pvc) and the volume",
    );
    ctx.log("");
    ctx.log(
      "this is useful, if you update the stateful set with new volume configuration (different size or storage class)",
    );
    ctx.log("");
    ctx.log(
      "Kubernetes will usually recreate the missing member with the updated config and mongodb will start synchronizing the new member.",
    );
    ctx.log("");
    ctx.log(
      "This works without downtime, but should be done when load on the db is low. Also it has not been tested with large dbs (> 10gi)",
    );
    ctx.log("");
    ctx.log(
      "Deleting the volume and claim often stuck, just wait or cancel and restart.",
    );
    ctx.log("");

    const understood = await ctx.confirm("DO YOU UNDERSTAND?");
    if (!understood) {
      throw new Error("abort");
    }

    const namespace = await getProjectNamespace(envComponent);
    const pvcs = await getProjectPvcs(envComponent);

    const podName = await ctx.get("podName");

    const thePvc = pvcs.find(
      (pvc: any) => pvc.metadata.name === `datadir-${podName}`,
    );
    if (!thePvc) {
      logError(ctx, `sorry, no pvc found for ${podName}`);
      return;
    }

    const shouldContinue = await ctx.confirm(
      "THIS WILL DESTROY THE POD, ITS VOLUME AND ALL ITS DATA 🙀🙀🙀!!! continue? 🤔",
    );
    if (!shouldContinue) {
      throw new Error("abort");
    }

    ctx.log("destroying volume...");
    try {
      await removeFinalizerAndDelete(
        namespace,
        "pv",
        (thePvc as any).spec.volumeName,
      );
    } catch (e: any) {
      ctx.log(e.message);
    }
    ctx.log("destroying volume claim...");
    try {
      await removeFinalizerAndDelete(
        namespace,
        "pvc",
        (thePvc as any).metadata.name,
      );
    } catch (e: any) {
      ctx.log(e.message);
    }
    ctx.log("destroying pod...");
    await removeFinalizerAndDelete(namespace, "pod", podName);
  },
});
