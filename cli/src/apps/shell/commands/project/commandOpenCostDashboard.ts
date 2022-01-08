import open from "open";
import Vorpal from "vorpal";
import {
  GRAFANA_PROXY_LOCAL_PORT,
  GRAFANA_PROXY_TARGET_PORT,
} from "../../../../config/constants";

import { startPortForward } from "../../../../utils/portForward";

import { getProjectNamespace } from "../../../../utils/projects";

import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";
export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-check-costs <envComponent>",
      "Shows you how much you're spending"
    )
    .autocomplete(envAutocompletion)
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const namespace = await getProjectNamespace(envComponent);
      const url = `http://localhost:${GRAFANA_PROXY_LOCAL_PORT}/namespace.html?name=${namespace}`;
      await startPortForward(
        "deployment/kubecost-cost-analyzer",
        GRAFANA_PROXY_LOCAL_PORT,
        GRAFANA_PROXY_TARGET_PORT,
        "kubecost"
      );
      open(url);
    });
