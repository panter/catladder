import open from "open";
import type Vorpal from "vorpal";
import {
  GRAFANA_PROXY_LOCAL_PORT,
  GRAFANA_PROXY_TARGET_PORT,
} from "../../../../config/constants";

import { startKubePortForward } from "../../../../kubernetes/portForward";

import { getProjectNamespace } from "../../../../utils/projects";

import { envAndComponents } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";
export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-check-costs <envComponent>",
      "Shows you how much you're spending"
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const namespace = await getProjectNamespace(envComponent);
      const url = `http://localhost:${GRAFANA_PROXY_LOCAL_PORT}/namespace.html?name=${namespace}`;
      await startKubePortForward(
        "deployment/kubecost-cost-analyzer",
        GRAFANA_PROXY_LOCAL_PORT,
        GRAFANA_PROXY_TARGET_PORT,
        "kubecost"
      );
      open(url);
    });
