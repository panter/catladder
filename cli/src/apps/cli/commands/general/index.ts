import memoizee from "memoizee";
import type Vorpal from "vorpal";
import { getk8sApi } from "../../../../k8sApi";
import { getCurrentContext } from "../../../../utils/cluster";
import { logError } from "../../../../utils/log";
import { syncBitwarden } from "../../../../utils/passwordstore";
import {
  getAllRunningPortForwards,
  stopPortForward,
} from "../../../../utils/portForward";
import { getShell } from "../../../../utils/shell";
import { namespaceAutoCompletion } from "./namespaceAutoCompletion";
import portForward from "./portForward";

const getAllNamespaces = memoizee(
  async () => {
    const k8sApi = getk8sApi();
    const res = await k8sApi.listNamespace();
    return res.body.items;
  },
  { maxAge: 30000, promise: true }
);

export const getAllNamespacesNames = async () => {
  const namespaces = await getAllNamespaces();
  return namespaces.map((n) => n.metadata.name);
};
export default async (vorpal: Vorpal) => {
  vorpal.command("current-context").action(async function () {
    this.log(await getCurrentContext());
  });

  vorpal
    .command("list-namespaces", "list all namespaces")
    .action(async function () {
      const namespaces = await getAllNamespacesNames();
      this.log(namespaces.join("\n"));
    });

  vorpal
    .command("list-secrets <namespace>", "show secrets")
    .autocomplete(namespaceAutoCompletion)
    .action(async function ({ namespace }) {
      const k8sApi = getk8sApi();
      const res = await k8sApi.listNamespacedSecret(namespace);

      this.log(res.body.items.map((n) => n.metadata.name).join("\n"));
    });

  vorpal.command("bw-sync", "force sync bitwarden").action(async function () {
    await syncBitwarden(true);
    this.log("done");
  });

  vorpal
    .command("list-pods <namespace>", "list all pods of namespace")
    .autocomplete(namespaceAutoCompletion)
    .action(async function ({ namespace }) {
      const k8sApi = getk8sApi();
      const res = await k8sApi.listNamespacedPod(namespace);
      this.log(res.body.items.map((n) => n.metadata.name).join("\n"));
    });

  vorpal
    .command("stop-portforward <name>", "stop a running port forward")
    .autocomplete({ data: async () => getAllRunningPortForwards() })
    .action(async function ({ name }) {
      stopPortForward(name.trim());
    });

  vorpal
    .command("get-shell <namespace>", "get a shell to a pod in the environment")
    .autocomplete(namespaceAutoCompletion)
    .action(async function ({ namespace }) {
      const k8sApi = getk8sApi();
      const res = await k8sApi.listNamespacedPod(namespace);
      if (res.body.items.length === 0) {
        logError(this, "sorry, no pods found");
        return;
      }
      const podNames = res.body.items.map((i) => i.metadata.name);
      const { podName } = await this.prompt({
        type: "list",
        name: "podName",
        choices: podNames,
        message: "Which pod? 🤔",
      });

      await getShell(namespace, podName);
    });

  portForward(vorpal);
};
