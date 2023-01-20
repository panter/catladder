import type Vorpal from "vorpal";
import { logError } from "../../../../utils/log";

import { startKubePortForward } from "../../../../kubernetes/portForward";

import { getk8sApi } from "../../../../k8sApi";
import { namespaceAutoCompletion } from "./namespaceAutoCompletion";

export default async (vorpal: Vorpal) =>
  vorpal
    .command("kube-port-forward <namespace>", "start port-forwarding")
    .autocomplete(namespaceAutoCompletion)
    .action(async function ({ namespace }) {
      const k8sApi = getk8sApi();
      const res = await k8sApi.listNamespacedPod(namespace);
      if (res.body.items.length === 0) {
        logError(this, "sorry, no pods found");
        return;
      }
      const podNames = res.body.items.map((i) => i.metadata.name);

      if (podNames.length === 0) {
        logError(this, "sorry, no pods found");
        return;
      }
      const { podName } = await this.prompt({
        type: "list",
        name: "podName",
        choices: podNames,
        message: "Which pod? 🤔",
      });

      const { localPort } = await this.prompt({
        type: "number",
        name: "localPort",

        message: "Local port: ",
      });

      const { remotePort } = await this.prompt({
        type: "number",
        name: "remotePort",

        message: "Remote port: ",
      });

      return startKubePortForward(podName, localPort, remotePort, namespace);
    });
