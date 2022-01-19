import open from "open";
import { startPortForward } from "../../../../utils/portForward";
import Vorpal from "vorpal";
import {
  GRAFANA_PROXY_LOCAL_PORT,
  GRAFANA_PROXY_TARGET_PORT,
} from "../../../../config/constants";

import { getProjectNamespace } from "../../../../utils/projects";

import { envAndComponents } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";
export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-grafana <envComponent>",
      "open Grafana dashboard for your namespace"
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const namespace = await getProjectNamespace(envComponent);
      const url = `http://localhost:${GRAFANA_PROXY_LOCAL_PORT}/grafana/d/at-cost-analysis-namespace2/namespace-utilization-metrics?var-namespace=${namespace}`;
      await startPortForward(
        "deployment/kubecost-cost-analyzer",
        GRAFANA_PROXY_LOCAL_PORT,
        GRAFANA_PROXY_TARGET_PORT,
        "kubecost"
      );
      open(url);
    });
