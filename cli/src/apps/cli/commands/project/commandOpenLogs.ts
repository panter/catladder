import type Vorpal from "vorpal";
import {
  getPipelineContextByChoice,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { openGoogleCloudLogs } from "../../../../kubernetes/openKubernetesDashboards";
import { envAndComponents } from "./utils/autocompletions";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-logs <envComponent>",
      "open google cloud logs (stackdriver logs)"
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);
      const context = await getPipelineContextByChoice(env, componentName);

      await openGoogleCloudLogs(this, context);
    });
