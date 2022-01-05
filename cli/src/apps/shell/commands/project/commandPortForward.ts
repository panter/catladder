import Vorpal from "vorpal";
import { logError } from "../../../../utils/log";
import { startPortForward } from "../../../../utils/portForward";
import {
  getProjectNamespace,
  getProjectPodNames,
} from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-port-forward <env>", "start port-forwarding")
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      await ensureCluster.call(this);
      const namespace = await getProjectNamespace(env);
      const podNames = await getProjectPodNames(env);
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
