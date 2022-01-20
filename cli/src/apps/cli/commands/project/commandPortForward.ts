import Vorpal from "vorpal";
import { logError } from "../../../../utils/log";
import { startPortForward } from "../../../../utils/portForward";
import {
  getProjectNamespace,
  getProjectPodNames,
} from "../../../../utils/projects";
import { envAndComponents } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default async (vorpal: Vorpal) =>
  vorpal
    .command("project-port-forward <envComponent>", "start port-forwarding")
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const namespace = await getProjectNamespace(envComponent);
      const podNames = await getProjectPodNames(envComponent);
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
