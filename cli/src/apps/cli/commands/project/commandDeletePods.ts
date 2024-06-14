import type Vorpal from "vorpal";
import { getk8sApi } from "../../../../k8sApi";
import { getProjectPodNames } from "../../../../kubernetes";

import { logError } from "../../../../utils/log";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAndComponents } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default async (vorpal: Vorpal) =>
  vorpal
    .command("project-delete-pods <envComponent>", "delete / restart pods")
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const namespace = await getProjectNamespace(envComponent);
      const podNames = await getProjectPodNames(envComponent);
      if (podNames.length === 0) {
        logError(this, "sorry, no pods found");
        return;
      }
      const { selectedPodNames } = await this.prompt({
        type: "checkbox",
        name: "selectedPodNames",
        choices: podNames,
        message: "Which pods to delete / restart ? 🤔  ",
      });

      this.log(
        "the following pods will be DELETED 🙀 (and therefore restarted 😸)",
      );
      this.log("");
      selectedPodNames.forEach((n: string) => this.log(n));
      this.log("");
      const { shouldContinue } = await this.prompt({
        type: "confirm",
        name: "shouldContinue",
        message: "Continue ? 🤔  ",
      });
      this.log("");
      const k8sApi = getk8sApi();
      if (shouldContinue) {
        for (const podName of selectedPodNames) {
          await k8sApi.deleteNamespacedPod(podName, namespace, "true");
          this.log(`deleted pod '${podName}'`);
        }
      }
    });
