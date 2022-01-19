import open from "open";
import Vorpal from "vorpal";
import {
  GRAFANA_PROXY_LOCAL_PORT,
  GRAFANA_PROXY_TARGET_PORT,
} from "../../../../config/constants";
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
    .command(
      "project-open-grafana-pod <envComponent>",
      "open Grafana dashboard for a specific pod"
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
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
      const namespace = await getProjectNamespace(envComponent);
      const url = `http://localhost:${GRAFANA_PROXY_LOCAL_PORT}/grafana/d/at-cost-analysis-pod/pod-cost-and-utilization-metrics?var-namespace=${namespace}&var-pod=${podName}`;
      await startPortForward(
        "deployment/kubecost-cost-analyzer",
        GRAFANA_PROXY_LOCAL_PORT,
        GRAFANA_PROXY_TARGET_PORT,
        "kubecost"
      );
      open(url);
    });
