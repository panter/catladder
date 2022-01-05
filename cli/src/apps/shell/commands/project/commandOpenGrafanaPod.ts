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

import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";
export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-grafana-pod <env>",
      "open Grafana dashboard for a specific pod"
    )
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      await ensureCluster.call(this);
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
      const namespace = await getProjectNamespace(env);
      const url = `http://localhost:${GRAFANA_PROXY_LOCAL_PORT}/grafana/d/at-cost-analysis-pod/pod-cost-and-utilization-metrics?var-namespace=${namespace}&var-pod=${podName}`;
      await startPortForward(
        "deployment/kubecost-cost-analyzer",
        GRAFANA_PROXY_LOCAL_PORT,
        GRAFANA_PROXY_TARGET_PORT,
        "kubecost"
      );
      open(url);
    });
