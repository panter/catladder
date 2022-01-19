import memoizee from "memoizee";
import Vorpal from "vorpal";
import k8sApi from "../../../../k8sApi";
import {
  connectToCluster,
  getAllClusterNames,
  getCurrentConnectedClusterName,
  getCurrentContext,
} from "../../../../utils/cluster";
import { logError } from "../../../../utils/log";
import { syncBitwarden } from "../../../../utils/passwordstore";
import {
  getAllRunningPortForwards,
  stopPortForward,
} from "../../../../utils/portForward";
import { getShell } from "../../../../utils/shell";
import { getGoogleAuthUserNumber } from "../../utils/getGoogleAuthUserNumber";
import {
  openGoogleCloudKubernetesDashboard,
  openGoogleCloudLogs,
} from "../shared";
import { namespaceAutoCompletion } from "./namespaceAutoCompletion";
import portForward from "./portForward";

const getAllNamespaces = memoizee(
  async () => {
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
  vorpal
    .command("connect-cluster <clustername>")
    .autocomplete(getAllClusterNames())
    .action(async function ({ clustername }) {
      this.log(`connecting to ${clustername}`);
      await connectToCluster(clustername);
    });
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
    .command("open-dashboard <namespace>", "open kubernetes dashboard")
    .autocomplete(namespaceAutoCompletion)
    .action(async function ({ namespace }) {
      const clustername = await getCurrentConnectedClusterName();
      const authGoogleNumber = await getGoogleAuthUserNumber.call(this, vorpal);

      await openGoogleCloudKubernetesDashboard(
        authGoogleNumber,
        clustername,
        namespace
      );
    });
  vorpal
    .command(
      "open-logs <namespace>",
      "open google cloud logs (stackdriver stuff)"
    )
    .autocomplete(namespaceAutoCompletion)
    .action(async function ({ namespace }) {
      const clustername = await getCurrentConnectedClusterName();
      const authGoogleNumber = await getGoogleAuthUserNumber.call(this, vorpal);

      await openGoogleCloudLogs(authGoogleNumber, clustername, namespace);
    });

  vorpal
    .command("get-shell <namespace>", "get a shell to a pod in the environment")
    .autocomplete(namespaceAutoCompletion)
    .action(async function ({ namespace }) {
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
