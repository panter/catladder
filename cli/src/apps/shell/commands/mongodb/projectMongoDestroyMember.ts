import { exec } from "child-process-promise";
import Vorpal from "vorpal";
import { logError } from "../../../../utils/log";
import {
  getProjectNamespace,
  getProjectPvcs
} from "../../../../utils/projects";
import { envAutocompletion } from "../project/utils/autocompletions";
import ensureCluster from "../project/utils/ensureCluster";
import { getMongoDbPodsWithReplInfo } from "./utils";

const removeFinalizer = async (
  namespace: string,
  type: "pod" | "pv" | "pvc",
  name: string
) =>
  exec(
    `kubectl patch --namespace ${namespace} ${type} ${name} -p '{"metadata":{"finalizers":null}}'`
  );

const deleteResource = async (
  namespace: string,
  type: "pod" | "pv" | "pvc",
  name: string
) => exec(`kubectl delete --namespace ${namespace} ${type} ${name}`);

const removeFinalizerAndDelete = async (
  namespace: string,
  type: "pod" | "pv" | "pvc",
  name: string
) => {
  return Promise.all([
    removeFinalizer(namespace, type, name),
    await deleteResource(namespace, type, name)
  ]);
};
export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-mongo-destroy-member <env>",
      "DESTROY a member of a replicaset in order to reinitialize it"
    )
    .autocomplete(envAutocompletion)
    .action(async function({ env }) {
      await ensureCluster.call(this);
      this.log(
        "this command tries to delete a (secondary) member of the replicaset, it's persistent volume claim (pvc) and the volume"
      );
      this.log("");
      this.log(
        "this is useful, if you update the stateful set with new volume configuration (different size or storage class)"
      );
      this.log("");
      this.log(
        "Kubernetes will usually recreate the missing member with the updated config and mongodb will start synchronizing the new member."
      );
      this.log("");
      this.log(
        "This works without downtime, but should be done when load on the db is low. Also it has not been tested with large dbs (> 10gi)"
      );
      this.log("");
      this.log(
        "Deleting the volume and claim often stuck, just wait or cancel and restart."
      );
      this.log("");
      const { understood } = await this.prompt({
        default: true,
        message: "DO YOU UNDERSTAND?",
        name: "understood",
        type: "confirm"
      });

      if (!understood) {
        throw new Error("abort");
      }

      const namespace = await getProjectNamespace(env);
      const mongodbPods = await getMongoDbPodsWithReplInfo(env);

      const pvcs = await getProjectPvcs(env);
      const secondaries = mongodbPods.filter(pod => !pod.isMaster);

      if (secondaries.length === 0) {
        logError(this, "sorry, no pods found");
        return;
      }

      const podName = (
        await this.prompt({
          type: "list",
          name: "podName",
          choices: secondaries.map(p => ({
            name: `[ secondary ] ${p.podName}`,
            value: p.podName
          })),
          message: "Which pod? 🤔"
        })
      ).podName;

      const thePvc = pvcs.find(
        pvc => pvc.metadata.name === `datadir-${podName}`
      );
      if (!thePvc) {
        logError(this, `sorry, no pvc found for ${podName}`);
        return;
      }
      const { shouldContinue } = await this.prompt({
        default: true,
        message:
          "THIS WILL DESTROY THE POD, ITS VOLUME AND ALL ITS DATA 🙀🙀🙀!!! continue? 🤔",
        name: "shouldContinue",
        type: "confirm"
      });

      if (!shouldContinue) {
        throw new Error("abort");
      }

      // force delete, see https://github.com/kubernetes/kubernetes/issues/77258#issuecomment-502209800
      this.log("destroying volume...");
      try {
        await removeFinalizerAndDelete(namespace, "pv", thePvc.spec.volumeName);
      } catch (e) {
        this.log(e.message);
      }
      this.log("destroying volume claim...");
      try {
        await removeFinalizerAndDelete(namespace, "pvc", thePvc.metadata.name);
      } catch (e) {
        this.log(e.message);
      }
      this.log("destroying pod...");
      await removeFinalizerAndDelete(namespace, "pod", podName);
    });
