import Vorpal from "vorpal";
import { logError } from "../../../../utils/log";

import { startPortForward } from "../../../../utils/portForward";

import k8sApi from "../../../../k8sApi";
import { namespaceAutoCompletion } from "./namespaceAutoCompletion";

export default (vorpal: Vorpal) =>
  vorpal
    .command("port-forward <namespace>", "start port-forwarding")
    .autocomplete(namespaceAutoCompletion)
    .action(async function ({ namespace }) {
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

      return startPortForward(podName, localPort, remotePort, namespace);
    });
