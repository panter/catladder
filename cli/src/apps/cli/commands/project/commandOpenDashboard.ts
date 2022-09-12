import type Vorpal from "vorpal";
import {
  getPipelineContextByChoice,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { getGoogleAuthUserNumber } from "../../utils/getGoogleAuthUserNumber";
import { openGoogleCloudKubernetesDashboard } from "../shared";
import { envAndComponents } from "./utils/autocompletions";
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

      if (
        !componentConfig.deploy.cluster ||
        componentConfig.deploy.cluster.type !== "gcloud"
      ) {
        throw new Error("no gcloud custer configured");
      }
      // currently only supports kubernetes
      const namespace = environment.envVars.KUBE_NAMESPACE;

      const authGoogleNumber = await getGoogleAuthUserNumber.call(this, vorpal);

      openGoogleCloudKubernetesDashboard(
        componentConfig.deploy.cluster,
        namespace,
        authGoogleNumber
      );
    });
