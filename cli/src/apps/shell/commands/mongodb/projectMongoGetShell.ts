import Vorpal from "vorpal";
import { logError } from "../../../../utils/log";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAutocompletion } from "../project/utils/autocompletions";
import ensureCluster from "../project/utils/ensureCluster";
import {
  getMongodbShell,
  getProjectMongodbAllPodsSortedWithLabel,
} from "./utils";

export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-mongo-get-shell <envComponent>",
      "get a shell to a mongodb in the environment"
    )
    .autocomplete(envAutocompletion)
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const namespace = await getProjectNamespace(envComponent);
      const podNames = await getProjectMongodbAllPodsSortedWithLabel(
        envComponent
      );
      if (podNames.length === 0) {
        logError(this, "sorry, no pods found");
        return;
      }
      let podName;
      if (podNames.length === 1) {
        podName = podNames[0];
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

      return getMongodbShell(namespace, podName);
    });
