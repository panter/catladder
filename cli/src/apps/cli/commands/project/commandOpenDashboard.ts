import { isOfDeployType } from "@catladder/pipeline";
import type Vorpal from "vorpal";
import {
  getPipelineContextByChoice,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { openGoogleCloudRunDashboard } from "../../../../gcloud/cloudRun/openCloudRunDashboards";
import { openGoogleCloudKubernetesDashboard } from "../../../../kubernetes/openKubernetesDashboards";

import { envAndComponents } from "./utils/autocompletions";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-dashboard <envComponent>",
      "open an apps dashboard (kubernetes or cloudrun)"
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);
      const context = await getPipelineContextByChoice(env, componentName);
      if (isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
        await openGoogleCloudKubernetesDashboard(this, context);
      }
      if (isOfDeployType(context.componentConfig.deploy, "google-cloudrun")) {
        await openGoogleCloudRunDashboard(this, context);
      }
    });
