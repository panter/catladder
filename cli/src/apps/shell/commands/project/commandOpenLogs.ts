import Vorpal from "vorpal";
import { getCurrentConnectedClusterName } from "../../../../utils/cluster";
import { getProjectNamespace } from "../../../../utils/projects";
import { getGoogleAuthUserNumber } from "../../utils/getGoogleAuthUserNumber";
import { openGoogleCloudLogs } from "../shared";
import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-logs <envComponent>",
      "open google cloud logs (stackdriver logs)"
    )
    .autocomplete(envAutocompletion)
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const clustername = await getCurrentConnectedClusterName();
      const namespace = await getProjectNamespace(envComponent);
      const authGoogleNumber = await getGoogleAuthUserNumber.call(this, vorpal);

      await openGoogleCloudLogs(authGoogleNumber, clustername, namespace);
    });
