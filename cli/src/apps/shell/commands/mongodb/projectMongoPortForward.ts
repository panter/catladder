import Vorpal from "vorpal";
import { logError } from "../../../../utils/log";
import { startPortForward } from "../../../../utils/portForward";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAutocompletion } from "../project/utils/autocompletions";
import ensureCluster from "../project/utils/ensureCluster";
import { getProjectMongodbAllPodsSortedWithLabel } from "./utils";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-mongo-port-forward <env>", "port foward to a mongodb")
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      await ensureCluster.call(this);
      const namespace = await getProjectNamespace(env);
      const podNames = await getProjectMongodbAllPodsSortedWithLabel(env);
      if (podNames.length === 0) {
        logError(this, "sorry, no pods found");
        return;
      }
      let podName;
      if (podNames.length === 1) {
        podName = podNames[0].value;
      } else {
        podName = (
          await this.prompt({
            type: "list",
            name: "podName",
            choices: podNames,
            message: "Which pod? 🤔",
          })
        ).podName;
      }

      const { localPort } = await this.prompt({
        type: "number",
        name: "localPort",
        default: "30000",
        message: "Local port: ",
      });
      return startPortForward(podName, localPort, 27017, namespace);
    });
