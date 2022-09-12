import type Vorpal from "vorpal";
import { getProjectPodNames } from "../../../../kubernetes";
import { logError } from "../../../../utils/log";
import { getProjectNamespace } from "../../../../utils/projects";
import { getShell } from "../../../../utils/shell";

import { envAndComponents } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-get-shell <envComponent>",
      "get a shell to a pod in the environment"
    )
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

      return getShell(namespace, podName);
    });
