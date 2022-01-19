import Vorpal from "vorpal";
import {
  getPipelineContextByChoice,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { getCurrentConnectedClusterName } from "../../../../utils/cluster";
import { getGoogleAuthUserNumber } from "../../utils/getGoogleAuthUserNumber";
import { openGoogleCloudKubernetesDashboard } from "../shared";
import { envAndComponents } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";
export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-dashboard <envComponent>",
      "open kubernetes dashboard on google"
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);
      const { componentConfig, environment } = await getPipelineContextByChoice(
        env,
        componentName
      );

      if (
        !componentConfig.deploy ||
        componentConfig.deploy.type !== "kubernetes"
      ) {
        throw new Error(
          "only kubernetes deployments are supported at the moment"
        );
      }
      // currently only supports kubernetes
      const namespace = environment.envVars.KUBE_NAMESPACE;
      await ensureCluster.call(this, envComponent); // TODO: implement
      const clustername = await getCurrentConnectedClusterName();

      const authGoogleNumber = await getGoogleAuthUserNumber.call(this, vorpal);

      openGoogleCloudKubernetesDashboard(
        authGoogleNumber,
        clustername,
        namespace
      );
    });
