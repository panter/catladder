import Vorpal from "vorpal";
import { logError } from "../../../../utils/log";
import {
  getProjectNamespace,
  getProjectPodNames,
} from "../../../../utils/projects";
import { getShell } from "../../../../utils/shell";

import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-get-shell <envComponent>",
      "get a shell to a pod in the environment"
    )
    .autocomplete(envAutocompletion)
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

      return getShell(namespace, podName);
    });
